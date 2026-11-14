import { secureStoreControl } from '../__mocks__/expo-secure-store';
import { nativeControl } from '../__mocks__/secure-native';
import { MemoryStore } from '../src/vault/store';
import { BIOMETRIC_MAX_AGE_MS, Vault } from '../src/vault/vault';
import { FAST_KDF, HOUR, makeVault, sampleEntry, TestClock } from './helpers';

const PIN = '4821';
const BIO_KEY = 'ov.bio.vk';
const LAST_PIN_KEY = 'ov.lastPinUnlock';
const LOCKOUT_KEY = 'ov.lockout';

function dumpStore(store: MemoryStore): string {
  return [...store.rows.values(), ...store.meta.values()]
    .flatMap((r) => (r instanceof Uint8Array ? [r] : [r.summary, r.secret]))
    .map((b) => Buffer.from(b).toString('latin1'))
    .join('');
}

describe('vault: storage', () => {
  it('writes nothing readable to the store', async () => {
    const { vault, store } = await makeVault(PIN);
    await vault.save(sampleEntry);
    const dump = dumpStore(store as MemoryStore);
    for (const needle of ['Bank', 'me@example', 'horse', PIN, 'bank.example', 'pin is not']) {
      expect(dump).not.toContain(needle);
    }
  });

  it('keeps only device-only items in secure storage and never the PIN', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    for (const k of secureStoreControl.keys) {
      expect(secureStoreControl.peek(k)).not.toContain(PIN);
    }
    expect(secureStoreControl.isAuthProtected(BIO_KEY)).toBe(true);
  });

  it('rejects ciphertext moved between records', async () => {
    const { vault, store } = await makeVault(PIN);
    const a = await vault.save(sampleEntry);
    const b = await vault.save({ ...sampleEntry, title: 'Email' });
    const mem = store as MemoryStore;
    const ra = mem.rows.get(a)!;
    mem.rows.set(b, { id: b, summary: ra.summary, secret: ra.secret });
    await expect(vault.get(b)).rejects.toThrow();
    await expect(vault.list()).rejects.toThrow();
  });

  it('rejects summary and secret blobs swapped within a record', async () => {
    const { vault, store } = await makeVault(PIN);
    const id = await vault.save(sampleEntry);
    const mem = store as MemoryStore;
    const r = mem.rows.get(id)!;
    mem.rows.set(id, { id, summary: r.secret, secret: r.summary });
    await expect(vault.getSecret(id)).rejects.toThrow();
  });

  it('truncates oversized fields and defaults an empty title', async () => {
    const { vault } = await makeVault(PIN);
    const id = await vault.save({ ...sampleEntry, title: '   ', notes: 'x'.repeat(20_000) });
    const e = await vault.get(id);
    expect(e.title).toBe('Untitled');
    expect(e.notes).toHaveLength(10_000);
  });

  it('keeps createdAt when an entry is edited', async () => {
    const { vault } = await makeVault(PIN);
    const id = await vault.save(sampleEntry);
    const before = await vault.get(id);
    await new Promise((r) => setTimeout(r, 5));
    await vault.save({ ...sampleEntry, password: 'new' }, id);
    const after = await vault.get(id);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
    expect(after.password).toBe('new');
  });

  it('refuses every operation while locked', async () => {
    const { vault } = await makeVault(PIN);
    const id = await vault.save(sampleEntry);
    vault.lock();
    await expect(vault.list()).rejects.toThrow('locked');
    await expect(vault.get(id)).rejects.toThrow('locked');
    await expect(vault.getSecret(id)).rejects.toThrow('locked');
    await expect(vault.save(sampleEntry)).rejects.toThrow('locked');
    await expect(vault.remove(id)).rejects.toThrow('locked');
    await expect(vault.exportAll()).rejects.toThrow('locked');
    await expect(vault.importEntries([], 'merge')).rejects.toThrow('locked');
    await expect(vault.enableBiometrics('x')).rejects.toThrow('locked');
  });

  it('zeroes the key bytes on lock and notifies listeners', async () => {
    const { vault } = await makeVault(PIN);
    const events: boolean[] = [];
    vault.onChange((u) => events.push(u));
    const key = (vault as unknown as { key: Uint8Array }).key;
    vault.lock();
    expect(key.every((b) => b === 0)).toBe(true);
    expect(events).toEqual([false]);
    vault.lock();
    expect(events).toEqual([false]);
  });
});

describe('vault: PIN unlock and lockout', () => {
  it('unlocks with the right PIN and resets the counter', async () => {
    const { vault } = await makeVault(PIN);
    vault.lock();
    expect(await vault.unlockWithPin('0000')).toMatchObject({ ok: false, reason: 'wrong-pin', attemptsLeft: 2 });
    expect(await vault.unlockWithPin(PIN)).toEqual({ ok: true });
    expect(await vault.lockoutStatus()).toEqual({ attemptsLeft: 3, lockedForMs: 0 });
  });

  it.each(['', '123', '12345', '12a4', ' 4821', '٤٨٢١'])('counts malformed PIN %p as a wrong attempt', async (bad) => {
    const { vault } = await makeVault(PIN);
    vault.lock();
    expect(await vault.unlockWithPin(bad)).toMatchObject({ ok: false, reason: 'wrong-pin', attemptsLeft: 2 });
  });

  it('locks for an hour after three wrong PINs, even against the right PIN', async () => {
    const { vault, clock } = await makeVault(PIN);
    vault.lock();
    await vault.unlockWithPin('1111');
    await vault.unlockWithPin('2222');
    expect(await vault.unlockWithPin('3333')).toMatchObject({ ok: false, attemptsLeft: 0, lockedForMs: HOUR });
    expect(await vault.unlockWithPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
    clock.advance(HOUR - 1);
    expect(await vault.unlockWithPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
    clock.advance(1);
    expect(await vault.unlockWithPin(PIN)).toEqual({ ok: true });
  });

  it('does not run the KDF while locked out', async () => {
    const { vault } = await makeVault(PIN);
    vault.lock();
    for (const p of ['1111', '2222', '3333']) await vault.unlockWithPin(p);
    const before = nativeControl.calls('deviceMac');
    await vault.unlockWithPin(PIN);
    expect(nativeControl.calls('deviceMac')).toBe(before);
  });

  it('is not bypassed by moving the wall clock forward', async () => {
    const { vault, clock } = await makeVault(PIN);
    vault.lock();
    for (const p of ['1111', '2222', '3333']) await vault.unlockWithPin(p);
    clock.setWall(clock.wall + 10 * HOUR);
    expect(await vault.unlockWithPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('survives a new Vault instance (app restart) mid-lockout', async () => {
    const { vault, store, clock } = await makeVault(PIN);
    vault.lock();
    for (const p of ['1111', '2222', '3333']) await vault.unlockWithPin(p);
    const restarted = new Vault(store, clock.now, FAST_KDF);
    expect(await restarted.unlockWithPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('fails closed when the lockout record is tampered with, and the lock still expires', async () => {
    const { vault, clock } = await makeVault(PIN);
    vault.lock();
    await vault.unlockWithPin('1111');
    secureStoreControl.tamper(LOCKOUT_KEY, '{garbage');
    expect(await vault.unlockWithPin(PIN)).toMatchObject({ ok: false, reason: 'locked' });
    const persisted = secureStoreControl.peek(LOCKOUT_KEY);
    expect(persisted).not.toBe('{garbage');
    clock.advance(HOUR);
    expect(await vault.unlockWithPin(PIN)).toEqual({ ok: true });
  });

  it('counts the attempt and rethrows when the hardware key is unavailable', async () => {
    const { vault } = await makeVault(PIN);
    vault.lock();
    nativeControl.setHardwareAvailable(false);
    await expect(vault.unlockWithPin(PIN)).rejects.toMatchObject({ code: 'ERR_KEYSTORE' });
    nativeControl.setHardwareAvailable(true);
    expect((await vault.lockoutStatus()).attemptsLeft).toBe(2);
    expect(vault.isUnlocked).toBe(false);
  });

  it('cannot be opened on another device even with the right PIN', async () => {
    const { vault, store, clock } = await makeVault(PIN);
    await vault.save(sampleEntry);
    vault.lock();
    nativeControl.newDevice();
    secureStoreControl.wipe();
    const thief = new Vault(store, clock.now, FAST_KDF);
    expect(await thief.unlockWithPin(PIN)).toMatchObject({ ok: false, reason: 'wrong-pin' });
  });

  it('cannot be opened after the hardware key is deleted', async () => {
    const { vault } = await makeVault(PIN);
    vault.lock();
    nativeControl.newDevice();
    expect((await vault.unlockWithPin(PIN)).ok).toBe(false);
  });
});

describe('vault: change PIN', () => {
  it('re-wraps the key without touching records', async () => {
    const { vault, store } = await makeVault(PIN);
    const id = await vault.save(sampleEntry);
    const mem = store as MemoryStore;
    const before = mem.rows.get(id)!.secret.slice();
    expect(await vault.changePin(PIN, '9090')).toEqual({ ok: true });
    expect(mem.rows.get(id)!.secret).toEqual(before);
    vault.lock();
    expect((await vault.unlockWithPin(PIN)).ok).toBe(false);
    expect((await vault.unlockWithPin('9090')).ok).toBe(true);
    expect((await vault.get(id)).notes).toBe(sampleEntry.notes);
  });

  it('goes through the lockout for the current PIN', async () => {
    const { vault } = await makeVault(PIN);
    expect(await vault.changePin('0000', '9090')).toMatchObject({ ok: false, attemptsLeft: 2 });
    await vault.changePin('0001', '9090');
    expect(await vault.changePin('0002', '9090')).toMatchObject({ ok: false, attemptsLeft: 0 });
    expect(await vault.changePin(PIN, '9090')).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('rejects a malformed new PIN before checking anything', async () => {
    const { vault } = await makeVault(PIN);
    await expect(vault.changePin(PIN, '12')).rejects.toThrow('4 digits');
    expect((await vault.lockoutStatus()).attemptsLeft).toBe(3);
  });
});

describe('vault: biometrics', () => {
  it('unlocks with the genuine key', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    vault.lock();
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(true);
    expect(secureStoreControl.prompts).toEqual(['Enable', 'Unlock']);
  });

  it('stays locked and keeps biometrics enabled when the user cancels', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    vault.lock();
    secureStoreControl.queuePrompts('cancel');
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(false);
    expect(vault.isUnlocked).toBe(false);
    expect(await vault.biometricsEnabled()).toBe(true);
  });

  it('stays locked when the OS locks out biometrics', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    vault.lock();
    secureStoreControl.queuePrompts('lockout');
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(false);
    expect(vault.isUnlocked).toBe(false);
  });

  it('disables itself when a new fingerprint or face is enrolled', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    vault.lock();
    secureStoreControl.enrollNewBiometric();
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(false);
    expect(await vault.biometricsEnabled()).toBe(false);
    expect(secureStoreControl.peek(BIO_KEY)).toBeNull();
  });

  it('rejects a forged key and disables biometrics', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    vault.lock();
    secureStoreControl.tamper(BIO_KEY, Buffer.alloc(32, 7).toString('base64'));
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(false);
    expect(await vault.biometricsEnabled()).toBe(false);
    expect(vault.isUnlocked).toBe(false);
  });

  it('requires the PIN again after 72 hours', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    vault.lock();
    secureStoreControl.tamper(LAST_PIN_KEY, String(Date.now() - BIOMETRIC_MAX_AGE_MS - 1));
    expect(await vault.canUseBiometrics()).toBe(false);
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(false);
    expect(secureStoreControl.prompts).toEqual(['Enable']);
  });

  it('distrusts a last-PIN timestamp from the future', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    secureStoreControl.tamper(LAST_PIN_KEY, String(Date.now() + HOUR));
    expect(await vault.canUseBiometrics()).toBe(false);
  });

  it('refuses to enable when the device has no biometrics', async () => {
    const { vault } = await makeVault(PIN);
    secureStoreControl.setBiometricAvailable(false);
    await expect(vault.enableBiometrics('Enable')).rejects.toThrow('not available');
    expect(await vault.biometricsEnabled()).toBe(false);
  });

  it('does not enable when the enrolment prompt is cancelled', async () => {
    const { vault } = await makeVault(PIN);
    secureStoreControl.queuePrompts('cancel');
    await expect(vault.enableBiometrics('Enable')).rejects.toThrow();
    expect(await vault.biometricsEnabled()).toBe(false);
  });

  it('is reset when a new vault is created', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    await vault.create('1357');
    expect(secureStoreControl.peek(BIO_KEY)).toBeNull();
  });
});

describe('vault: import and destroy', () => {
  it('replace-import swaps contents and keeps the vault openable with biometrics', async () => {
    const { vault } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    await vault.save(sampleEntry);
    await vault.importEntries([{ ...sampleEntry, id: 'abc', title: 'Imported', createdAt: 1, updatedAt: 2 }], 'replace');
    expect((await vault.list()).map((e) => e.title)).toEqual(['Imported']);
    vault.lock();
    expect(await vault.unlockWithBiometrics('Unlock')).toBe(true);
    vault.lock();
    expect((await vault.unlockWithPin(PIN)).ok).toBe(true);
  });

  it('merge-import keeps existing entries and overwrites by id', async () => {
    const { vault } = await makeVault(PIN);
    const keep = await vault.save(sampleEntry);
    await vault.importEntries(
      [
        { ...sampleEntry, id: keep, title: 'Overwritten', createdAt: 1, updatedAt: 2 },
        { ...sampleEntry, id: 'new1', title: 'Added', createdAt: 1, updatedAt: 2 },
      ],
      'merge',
    );
    expect((await vault.list()).map((e) => e.title)).toEqual(['Added', 'Overwritten']);
  });

  it('destroy wipes the store, secure storage and hardware key', async () => {
    const { vault, store } = await makeVault(PIN);
    await vault.enableBiometrics('Enable');
    await vault.save(sampleEntry);
    await vault.destroy();
    expect(vault.isUnlocked).toBe(false);
    expect(await vault.isInitialized()).toBe(false);
    expect((store as MemoryStore).rows.size).toBe(0);
    expect(secureStoreControl.keys).toEqual([]);
    expect(nativeControl.hasDeviceKey).toBe(false);
  });

  it('create() with entries is atomic from the listener point of view', async () => {
    const store = new MemoryStore();
    const clock = new TestClock();
    const vault = new Vault(store, clock.now, FAST_KDF);
    const seen: number[] = [];
    vault.onChange(() => void vault.list().then((l) => seen.push(l.length)));
    await vault.create(PIN, [{ ...sampleEntry, id: 'x1', createdAt: 1, updatedAt: 1 }]);
    await new Promise((r) => setImmediate(r));
    expect(seen).toEqual([1]);
  });
});
