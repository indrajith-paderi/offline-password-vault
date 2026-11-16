import { nativeControl } from '../__mocks__/secure-native';
import {
  backupFileName,
  BackupFormatError,
  createBackup,
  openBackup,
  readBackupInfo,
} from '../src/backup/format';
import { seal } from '../src/crypto/aead';
import { utf8Encode } from '../src/crypto/bytes';
import { argon2id } from '../src/crypto/kdf';
import { DEFAULT_AUTO_LOCK_MS } from '../src/security/idleLocker';
import { deriveKek } from '../src/vault/keys';
import { MemoryStore } from '../src/vault/store';
import { systemClock, Vault } from '../src/vault/vault';
import { FAST_KDF, makeVault, TestClock } from './helpers';

const PW = 'Edge-Passw0rd!';

function withPayload(payload: string): Uint8Array {
  const template = createBackup([], PW, { appVersion: '1', kdf: FAST_KDF });
  const appLen = template[38];
  const header = template.slice(0, 39 + appLen);
  const key = argon2id(utf8Encode(PW), template.slice(14, 30), readBackupInfo(template).kdf);
  const body = seal(key, utf8Encode(payload), header);
  return Uint8Array.from([...header, ...body]);
}

describe('backup edge cases', () => {
  it.each(['not json', 'null', '42', '"str"', '{"v":2,"entries":[]}', '{"v":1}', '{"v":1,"entries":{}}'])(
    'rejects authenticated payload %s as malformed',
    (payload) => {
      expect(() => openBackup(withPayload(payload), PW)).toThrow(BackupFormatError);
    },
  );

  it('accepts an empty but valid payload', () => {
    expect(openBackup(withPayload('{"v":1,"entries":[]}'), PW).entries).toEqual([]);
  });

  it('rejects unknown format versions and KDF ids before deriving', () => {
    const file = createBackup([], PW, { appVersion: '1', kdf: FAST_KDF });
    const v2 = Uint8Array.from(file);
    v2[4] = 2;
    expect(() => readBackupInfo(v2)).toThrow(/v2 is not supported/);
    const kdf = Uint8Array.from(file);
    kdf[5] = 9;
    expect(() => readBackupInfo(kdf)).toThrow(/key-derivation method/);
  });

  it('rejects a file whose app version runs past the end', () => {
    const file = createBackup([], PW, { appVersion: '1', kdf: FAST_KDF });
    const bad = Uint8Array.from(file.slice(0, 39 + 30));
    bad[38] = 200;
    expect(() => readBackupInfo(bad)).toThrow(/truncated/);
  });

  it('caps the app version at 255 bytes', () => {
    const file = createBackup([], PW, { appVersion: 'x'.repeat(400), kdf: FAST_KDF });
    expect(readBackupInfo(file).appVersion).toHaveLength(255);
  });

  it('refuses files over 50 MB without reading them', () => {
    expect(() => readBackupInfo(new Uint8Array(50 * 1024 * 1024 + 1))).toThrow(/too large/);
  });

  it('names files with a sortable local timestamp', () => {
    expect(backupFileName(new Date(2026, 0, 5, 7, 8, 9))).toBe('vault_backup_20260105_070809.enc');
    expect(backupFileName()).toMatch(/^vault_backup_\d{8}_\d{6}\.enc$/);
  });
});

describe('vault edge cases', () => {
  it('builds the system clock from native monotonic time and boot id', () => {
    const c = systemClock();
    expect(c.mono).toBe(nativeControl.clock.mono);
    expect(c.boot).toBe(nativeControl.clock.boot);
    expect(Math.abs(c.wall - Date.now())).toBeLessThan(1000);
  });

  it('rejects a malformed PIN when deriving a KEK', async () => {
    await expect(deriveKek('12345', new Uint8Array(16), FAST_KDF)).rejects.toThrow('4 digits');
    await expect(deriveKek('abcd', new Uint8Array(16), FAST_KDF)).rejects.toThrow('4 digits');
  });

  it('refuses to create a vault with a malformed PIN', async () => {
    const vault = new Vault(new MemoryStore(), new TestClock().now, FAST_KDF);
    await expect(vault.create('123')).rejects.toThrow('4 digits');
    expect(await vault.isInitialized()).toBe(false);
  });

  it('stays locked and wipes the key if create() fails to persist', async () => {
    const store = new MemoryStore();
    jest.spyOn(store, 'replaceAll').mockRejectedValueOnce(new Error('disk full'));
    const vault = new Vault(store, new TestClock().now, FAST_KDF);
    const events: boolean[] = [];
    vault.onChange((u) => events.push(u));
    await expect(vault.create('4821')).rejects.toThrow('disk full');
    expect(vault.isUnlocked).toBe(false);
    expect(events).not.toContain(true);
  });

  it('reports missing entries', async () => {
    const { vault } = await makeVault();
    await expect(vault.get('missing')).rejects.toThrow('Not found');
    await expect(vault.getSecret('missing')).rejects.toThrow('Not found');
  });

  it('unsubscribes listeners', async () => {
    const { vault } = await makeVault();
    const fn = jest.fn();
    const off = vault.onChange(fn);
    off();
    vault.lock();
    expect(fn).not.toHaveBeenCalled();
  });

  it('refuses to unlock a vault that was never created', async () => {
    const vault = new Vault(new MemoryStore(), new TestClock().now, FAST_KDF);
    await expect(vault.unlockWithPin('4821')).rejects.toThrow('not initialized');
  });
});

describe('settings', () => {
  it('defaults when nothing is stored', async () => {
    const { vault } = await makeVault();
    expect(await vault.getSettings()).toEqual({ autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it('round-trips an allowed timeout', async () => {
    const { vault } = await makeVault();
    await vault.saveSettings({ autoLockMs: 30_000 });
    expect(await vault.getSettings()).toEqual({ autoLockMs: 30_000 });
  });

  it.each([0, -1, 1, 59_999, 10 * 60 * 60 * 1000, NaN])('ignores an unsupported timeout %p', async (ms) => {
    const { vault } = await makeVault();
    await vault.saveSettings({ autoLockMs: ms });
    expect(await vault.getSettings()).toEqual({ autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it.each(['{broken', '0', '{"autoLockMs":"30000"}', '{"autoLockMs":0}'])('falls back to defaults for stored %s', async (raw) => {
    const { vault, store } = await makeVault();
    await store.setMeta({ settings: utf8Encode(raw) });
    expect(await vault.getSettings()).toEqual({ autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it('stores settings encrypted, not as readable JSON', async () => {
    const { vault, store } = await makeVault();
    await vault.saveSettings({ autoLockMs: 30_000 });
    const raw = (await store.getMeta('settings'))!;
    expect(Buffer.from(raw).toString('latin1')).not.toContain('autoLockMs');
  });

  it('cannot read or write settings while locked', async () => {
    const { vault } = await makeVault();
    vault.lock();
    await expect(vault.getSettings()).rejects.toThrow('locked');
    await expect(vault.saveSettings({ autoLockMs: 30_000 })).rejects.toThrow('locked');
  });

  it('migrates plain-text settings from older versions and re-saves them encrypted', async () => {
    const { vault, store } = await makeVault();
    await store.setMeta({ settings: utf8Encode('{"autoLockMs":30000}') });
    expect(await vault.getSettings()).toEqual({ autoLockMs: 30_000 });
    const raw = (await store.getMeta('settings'))!;
    expect(Buffer.from(raw).toString('latin1')).not.toContain('autoLockMs');
    expect(await vault.getSettings()).toEqual({ autoLockMs: 30_000 });
  });

  it('ignores a settings blob sealed under a different label', async () => {
    const { vault, store } = await makeVault();
    await vault.saveSettings({ autoLockMs: 30_000 });
    const canary = (await store.getMeta('canary'))!;
    await store.setMeta({ settings: canary });
    expect(await vault.getSettings()).toEqual({ autoLockMs: DEFAULT_AUTO_LOCK_MS });
  });

  it('keeps settings after the PIN is changed', async () => {
    const { vault } = await makeVault();
    await vault.saveSettings({ autoLockMs: 30_000 });
    await vault.changePin('4821', '1357');
    vault.lock();
    await vault.unlockWithPin('1357');
    expect(await vault.getSettings()).toEqual({ autoLockMs: 30_000 });
  });
});
