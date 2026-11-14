import { __test as device } from '../__mocks__/secure-native';
import { __store as kv } from '../__mocks__/expo-secure-store';
import { MemoryStore } from '../src/vault/store';
import { Vault } from '../src/vault/vault';
import { utf8Decode } from '../src/crypto/bytes';

const FAST = { ops: 2, memKiB: 19 * 1024 };
let t = 1_000_000;
const clock = () => ({ wall: t, mono: t, boot: 'b' });

const sample = {
  title: 'Bank',
  username: 'me@example.com',
  url: 'https://bank.example',
  password: 'correct horse battery staple',
  notes: 'pin is not 1234',
};

async function freshVault(pin = '4821') {
  kv.clear();
  device.resetDevice();
  const store = new MemoryStore();
  const vault = new Vault(store, clock, FAST);
  await vault.create(pin);
  return { store, vault };
}

describe('vault', () => {
  it('stores nothing readable on disk', async () => {
    const { store, vault } = await freshVault();
    await vault.save(sample);
    const dump = [...store.rows.values(), ...store.meta.values()]
      .flatMap((r) => (r instanceof Uint8Array ? [r] : [r.summary, r.secret]))
      .map((b) => Buffer.from(b).toString('latin1'))
      .join('');
    for (const needle of ['Bank', 'me@example', 'horse', '4821', 'bank.example']) {
      expect(dump).not.toContain(needle);
    }
  });

  it('locks, then unlocks with the right PIN only', async () => {
    const { vault } = await freshVault();
    const id = await vault.save(sample);
    vault.lock();
    expect(vault.isUnlocked).toBe(false);
    await expect(vault.list()).rejects.toThrow('locked');

    const bad = await vault.unlockWithPin('0000');
    expect(bad).toMatchObject({ ok: false, reason: 'wrong-pin', attemptsLeft: 2 });

    expect(await vault.unlockWithPin('4821')).toEqual({ ok: true });
    expect((await vault.getSecret(id)).password).toBe(sample.password);
    expect((await vault.lockoutStatus()).attemptsLeft).toBe(3);
  });

  it('blocks for an hour after three wrong PINs, even for the right one', async () => {
    const { vault } = await freshVault();
    vault.lock();
    await vault.unlockWithPin('1111');
    await vault.unlockWithPin('2222');
    const third = await vault.unlockWithPin('3333');
    expect(third).toMatchObject({ ok: false, attemptsLeft: 0 });
    expect(await vault.unlockWithPin('4821')).toMatchObject({ ok: false, reason: 'locked' });
    t += 60 * 60 * 1000;
    expect(await vault.unlockWithPin('4821')).toEqual({ ok: true });
  });

  it('a copied database is useless on another phone, even with the PIN', async () => {
    const { store, vault } = await freshVault();
    await vault.save(sample);
    vault.lock();
    device.resetDevice(); // "different hardware"
    const thief = new Vault(store, clock, FAST);
    expect(await thief.unlockWithPin('4821')).toMatchObject({ ok: false, reason: 'wrong-pin' });
  });

  it('changing the PIN keeps every record without re-encrypting them', async () => {
    const { store, vault } = await freshVault();
    const id = await vault.save(sample);
    const before = store.rows.get(id)!.secret.slice();
    expect(await vault.changePin('4821', '9090')).toEqual({ ok: true });
    expect(store.rows.get(id)!.secret).toEqual(before);
    vault.lock();
    expect((await vault.unlockWithPin('4821')).ok).toBe(false);
    expect((await vault.unlockWithPin('9090')).ok).toBe(true);
    expect((await vault.get(id)).notes).toBe(sample.notes);
  });

  it('refuses ciphertext swapped between records', async () => {
    const { store, vault } = await freshVault();
    const a = await vault.save(sample);
    const b = await vault.save({ ...sample, title: 'Email' });
    const ra = store.rows.get(a)!;
    store.rows.set(b, { id: b, summary: ra.summary, secret: ra.secret });
    await expect(vault.get(b)).rejects.toThrow();
  });

  it('unlocks with biometrics, but only with the genuine key', async () => {
    const { vault } = await freshVault();
    await vault.enableBiometrics('Unlock');
    vault.lock();
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(true);
    vault.lock();
    kv.set('ov.bio.vk', Buffer.alloc(32, 7).toString('base64')); // forged key
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(false);
    expect(await vault.biometricsEnabled()).toBe(false);
  });

  it('requires the PIN again after 72 hours of biometric-only unlocks', async () => {
    const { vault } = await freshVault();
    await vault.enableBiometrics('Unlock');
    vault.lock();
    kv.set('ov.lastPinUnlock', String(Date.now() - 73 * 60 * 60 * 1000));
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(false);
  });

  it('wipes the key bytes on lock', async () => {
    const { vault } = await freshVault();
    const key = (vault as unknown as { key: Uint8Array }).key;
    vault.lock();
    expect(key.every((b) => b === 0)).toBe(true);
  });

  it('replace-import swaps contents and keeps the vault openable', async () => {
    const { vault } = await freshVault();
    await vault.save(sample);
    const n = await vault.importEntries(
      [{ ...sample, id: 'abc', title: 'Imported', createdAt: 1, updatedAt: 2 }],
      'replace',
    );
    expect(n).toBe(1);
    expect((await vault.list()).map((e) => e.title)).toEqual(['Imported']);
    vault.lock();
    expect((await vault.unlockWithPin('4821')).ok).toBe(true);
    expect(utf8Decode(new TextEncoder().encode((await vault.get('abc')).password))).toBe(
      sample.password,
    );
  });
});
