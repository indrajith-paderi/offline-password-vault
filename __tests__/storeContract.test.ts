import { sqliteControl } from '../__mocks__/expo-sqlite';
import { SqliteStore } from '../src/vault/sqliteStore';
import { MemoryStore, VaultStore } from '../src/vault/store';
import { Vault } from '../src/vault/vault';
import { FAST_KDF, sampleEntry, TestClock } from './helpers';

const ALL_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);
const row = (id: string, fill = 1) => ({ id, summary: new Uint8Array(40).fill(fill), secret: new Uint8Array(60).fill(fill + 1) });

beforeEach(() => sqliteControl.reset());
afterAll(() => sqliteControl.reset());

const stores: [string, () => Promise<VaultStore>][] = [
  ['MemoryStore', async () => new MemoryStore()],
  ['SqliteStore', () => SqliteStore.open()],
];

describe.each(stores)('%s contract', (_name, make) => {
  it('returns null for missing meta and rows', async () => {
    const s = await make();
    expect(await s.getMeta('nope')).toBeNull();
    expect(await s.getRow('nope')).toBeNull();
    expect(await s.listRows()).toEqual([]);
  });

  it('stores every byte value exactly', async () => {
    const s = await make();
    await s.setMeta({ blob: ALL_BYTES });
    await s.putRow({ id: 'r', summary: ALL_BYTES, secret: ALL_BYTES.slice().reverse() });
    expect(await s.getMeta('blob')).toEqual(ALL_BYTES);
    const r = await s.getRow('r');
    expect(r?.summary).toEqual(ALL_BYTES);
    expect(r?.secret).toEqual(ALL_BYTES.slice().reverse());
  });

  it('overwrites meta and rows by key', async () => {
    const s = await make();
    await s.setMeta({ a: Uint8Array.of(1) });
    await s.setMeta({ a: Uint8Array.of(2), b: Uint8Array.of(3) });
    expect(await s.getMeta('a')).toEqual(Uint8Array.of(2));
    expect(await s.getMeta('b')).toEqual(Uint8Array.of(3));
    await s.putRow(row('x', 1));
    await s.putRow(row('x', 9));
    expect((await s.listRows()).length).toBe(1);
    expect((await s.getRow('x'))?.summary[0]).toBe(9);
  });

  it('deletes rows and ignores missing ids', async () => {
    const s = await make();
    await s.putRow(row('x'));
    await s.deleteRow('x');
    await s.deleteRow('never-existed');
    expect(await s.getRow('x')).toBeNull();
  });

  it('replaceAll swaps both meta and rows', async () => {
    const s = await make();
    await s.setMeta({ old: Uint8Array.of(1) });
    await s.putRow(row('old'));
    await s.replaceAll({ fresh: Uint8Array.of(2) }, [row('n1'), row('n2')]);
    expect(await s.getMeta('old')).toBeNull();
    expect(await s.getMeta('fresh')).toEqual(Uint8Array.of(2));
    expect((await s.listRows()).map((r) => r.id).sort()).toEqual(['n1', 'n2']);
  });

  it('wipe removes everything', async () => {
    const s = await make();
    await s.setMeta({ a: Uint8Array.of(1) });
    await s.putRow(row('x'));
    await s.wipe();
    expect(await s.getMeta('a')).toBeNull();
    expect(await s.listRows()).toEqual([]);
  });

  it('hands out copies, so callers wiping buffers cannot corrupt the store', async () => {
    const s = await make();
    const meta = Uint8Array.of(1, 2, 3);
    await s.setMeta({ m: meta });
    meta.fill(0);
    const got = await s.getMeta('m');
    expect(got).toEqual(Uint8Array.of(1, 2, 3));
    got!.fill(0);
    expect(await s.getMeta('m')).toEqual(Uint8Array.of(1, 2, 3));

    const r = row('x', 5);
    await s.putRow(r);
    r.summary.fill(0);
    const back = await s.getRow('x');
    back!.secret.fill(0);
    expect((await s.getRow('x'))?.summary[0]).toBe(5);
    expect((await s.getRow('x'))?.secret[0]).toBe(6);
  });

  it('runs a full vault lifecycle', async () => {
    const s = await make();
    const clock = new TestClock();
    const vault = new Vault(s, clock.now, FAST_KDF);
    await vault.create('4821');
    const id = await vault.save(sampleEntry);
    vault.lock();
    const again = new Vault(s, clock.now, FAST_KDF);
    expect(await again.unlockWithPin('4821')).toEqual({ ok: true });
    expect((await again.getSecret(id)).password).toBe(sampleEntry.password);
  });
});

describe('SqliteStore durability', () => {
  it('persists across reopen', async () => {
    const a = await SqliteStore.open();
    await a.putRow(row('keep'));
    const b = await SqliteStore.open();
    expect(await b.getRow('keep')).not.toBeNull();
  });

  it('rolls back replaceAll when the disk fails halfway', async () => {
    const s = await SqliteStore.open();
    await s.replaceAll({ header: Uint8Array.of(1) }, [row('a'), row('b')]);
    sqliteControl.failAfter(4);
    await expect(s.replaceAll({ header: Uint8Array.of(2) }, [row('c'), row('d'), row('e')])).rejects.toThrow('IOERR');
    expect(await s.getMeta('header')).toEqual(Uint8Array.of(1));
    expect((await s.listRows()).map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps the old vault openable when a restore dies mid-write', async () => {
    const s = await SqliteStore.open();
    const clock = new TestClock();
    const vault = new Vault(s, clock.now, FAST_KDF);
    await vault.create('4821');
    const id = await vault.save(sampleEntry);
    const incoming = Array.from({ length: 5 }, (_, i) => ({ ...sampleEntry, id: `n${i}`, createdAt: 1, updatedAt: 1 }));
    sqliteControl.failAfter(3);
    await expect(vault.importEntries(incoming, 'replace')).rejects.toThrow('IOERR');
    vault.lock();
    expect(await vault.unlockWithPin('4821')).toEqual({ ok: true });
    expect((await vault.list()).map((e) => e.id)).toEqual([id]);
  });

  it('rolls back setMeta as a unit', async () => {
    const s = await SqliteStore.open();
    await s.setMeta({ a: Uint8Array.of(1), b: Uint8Array.of(1) });
    sqliteControl.failAfter(1);
    await expect(s.setMeta({ a: Uint8Array.of(2), b: Uint8Array.of(2) })).rejects.toThrow();
    expect(await s.getMeta('a')).toEqual(Uint8Array.of(1));
    expect(await s.getMeta('b')).toEqual(Uint8Array.of(1));
  });

  it('enables secure_delete and stores no plaintext in the database file', async () => {
    const s = await SqliteStore.open();
    const vault = new Vault(s, new TestClock().now, FAST_KDF);
    await vault.create('4821');
    await vault.save(sampleEntry);
    const raw = sqliteControl.raw('vault.db')!;
    expect(raw.prepare('PRAGMA secure_delete').get()).toEqual(expect.objectContaining({ secure_delete: 1 }));
    const blobs = raw.prepare('SELECT summary, secret FROM entries').all() as { summary: Uint8Array; secret: Uint8Array }[];
    const text = blobs.map((b) => Buffer.from(b.summary).toString('latin1') + Buffer.from(b.secret).toString('latin1')).join('');
    expect(text).not.toContain('Bank');
    expect(text).not.toContain('horse');
  });
});
