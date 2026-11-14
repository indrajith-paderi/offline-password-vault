import * as SecureStore from 'expo-secure-store';
import SecureNative from '../../modules/secure-native';
import { DecryptError, open, seal } from '../crypto/aead';
import { fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode, wipe } from '../crypto/bytes';
import { KdfParams, VAULT_KDF } from '../crypto/kdf';
import {
  decodeHeader,
  encodeHeader,
  isValidPin,
  newVaultKey,
  unwrapVaultKey,
  wrapVaultKey,
} from './keys';
import {
  attemptsLeft,
  beginAttempt,
  Clock,
  fail,
  INITIAL_LOCKOUT,
  lockRemainingMs,
  LockoutState,
  parseLockout,
  succeed,
} from './lockout';
import type { VaultStore } from './store';
import type { EncryptedRow, Entry, EntrySecret, EntrySummary } from './types';

const META_HEADER = 'header';
const KV_LOCKOUT = 'ov.lockout';
const KV_BIO_KEY = 'ov.bio.vk';
const KV_LAST_PIN = 'ov.lastPinUnlock';

/** Biometrics are a convenience, not a substitute: the PIN is required at least this often. */
export const BIOMETRIC_MAX_AGE_MS = 72 * 60 * 60 * 1000;

const DEVICE_ONLY = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type UnlockResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-pin'; attemptsLeft: number; lockedForMs: number }
  | { ok: false; reason: 'locked'; lockedForMs: number };

export type EntryInput = {
  title: string;
  username: string;
  url: string;
  password: string;
  notes: string;
};

export type ListedEntry = EntrySummary & { id: string };

const summaryAad = (id: string) => `OV-S-v1|${id}`;
const secretAad = (id: string) => `OV-X-v1|${id}`;

export function systemClock(): Clock {
  return { wall: Date.now(), mono: SecureNative.monotonicMs(), boot: SecureNative.bootId() };
}

type Listener = (unlocked: boolean) => void;

export class Vault {
  /** The only copy of the vault key in memory. Wiped on lock. */
  private key: Uint8Array | null = null;
  private listeners = new Set<Listener>();

  constructor(
    private store: VaultStore,
    private clock: () => Clock = systemClock,
    private kdf: KdfParams = VAULT_KDF,
  ) {}

  // ---- state -----------------------------------------------------------------------------

  get isUnlocked(): boolean {
    return this.key !== null;
  }

  async isInitialized(): Promise<boolean> {
    return (await this.store.getMeta(META_HEADER)) !== null;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.isUnlocked);
  }

  private requireKey(): Uint8Array {
    if (!this.key) throw new Error('Vault is locked');
    return this.key;
  }

  lock(): void {
    if (!this.key) return;
    wipe(this.key);
    this.key = null;
    this.emit();
  }

  // ---- setup -----------------------------------------------------------------------------

  /**
   * Fresh vault with a fresh hardware key. Also used after restoring onto a new phone,
   * so the old phone's device keys are never reused.
   */
  async create(pin: string): Promise<void> {
    if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits');
    await SecureNative.deleteDeviceKey();
    await SecureStore.deleteItemAsync(KV_BIO_KEY);
    const vaultKey = newVaultKey();
    const header = await wrapVaultKey(pin, vaultKey, this.kdf);
    await this.store.replaceAll({ [META_HEADER]: encodeHeader(header) }, []);
    await this.saveLockout(INITIAL_LOCKOUT);
    this.setKey(vaultKey);
    await this.markPinUnlock();
  }

  // ---- unlock ----------------------------------------------------------------------------

  async lockoutStatus(): Promise<{ attemptsLeft: number; lockedForMs: number }> {
    const s = await this.loadLockout();
    const now = this.clock();
    return { attemptsLeft: attemptsLeft(s, now), lockedForMs: lockRemainingMs(s, now) };
  }

  async unlockWithPin(pin: string): Promise<UnlockResult> {
    const now = this.clock();
    let state = await this.loadLockout();
    const lockedForMs = lockRemainingMs(state, now);
    if (lockedForMs > 0) return { ok: false, reason: 'locked', lockedForMs };

    // Persist the attempt first; only a correct PIN takes it back.
    state = beginAttempt(state, now);
    await this.saveLockout(state);

    const header = decodeHeader(await this.requireMeta(META_HEADER));
    try {
      const vaultKey = isValidPin(pin) ? await unwrapVaultKey(pin, header) : null;
      if (!vaultKey) throw new DecryptError();
      await this.saveLockout(succeed());
      this.setKey(vaultKey);
      await this.markPinUnlock();
      return { ok: true };
    } catch (e) {
      if (!(e instanceof DecryptError)) throw e;
      const after = this.clock();
      state = fail(state, after);
      await this.saveLockout(state);
      return {
        ok: false,
        reason: 'wrong-pin',
        attemptsLeft: attemptsLeft(state, after),
        lockedForMs: lockRemainingMs(state, after),
      };
    }
  }

  async biometricsEnabled(): Promise<boolean> {
    // Presence flag lives in meta so we can check without triggering a biometric prompt.
    const flag = await this.store.getMeta('bio');
    return flag !== null && flag[0] === 1;
  }

  /** Is biometric unlock allowed right now? False if disabled or the PIN is overdue. */
  async canUseBiometrics(): Promise<boolean> {
    if (!(await this.biometricsEnabled())) return false;
    const last = Number(await SecureStore.getItemAsync(KV_LAST_PIN, DEVICE_ONLY));
    return Number.isFinite(last) && Date.now() - last < BIOMETRIC_MAX_AGE_MS && last <= Date.now();
  }

  async enableBiometrics(prompt: string): Promise<void> {
    const key = this.requireKey();
    if (!SecureStore.canUseBiometricAuthentication()) {
      throw new Error('Biometric authentication is not available on this device');
    }
    // Stored under a Keystore/Keychain key that requires a strong biometric and is
    // invalidated when fingerprints/faces are added. The PIN itself is never stored.
    await SecureStore.setItemAsync(KV_BIO_KEY, toBase64(key), {
      requireAuthentication: true,
      authenticationPrompt: prompt,
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
    await this.store.setMeta({ bio: Uint8Array.of(1) });
  }

  async disableBiometrics(): Promise<void> {
    await SecureStore.deleteItemAsync(KV_BIO_KEY);
    await this.store.setMeta({ bio: Uint8Array.of(0) });
  }

  /** Returns false if cancelled, unavailable, or the biometric key was invalidated. */
  async unlockWithBiometrics(prompt: string): Promise<boolean> {
    if (!(await this.canUseBiometrics())) return false;
    let b64: string | null = null;
    try {
      b64 = await SecureStore.getItemAsync(KV_BIO_KEY, {
        requireAuthentication: true,
        authenticationPrompt: prompt,
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      });
    } catch {
      return false;
    }
    if (!b64) {
      // Key invalidated (new fingerprint enrolled, etc.). Make them use the PIN.
      await this.disableBiometrics();
      return false;
    }
    const candidate = fromBase64(b64);
    // Prove it's the real vault key before trusting it.
    if (!(await this.verifyKey(candidate))) {
      wipe(candidate);
      await this.disableBiometrics();
      return false;
    }
    this.setKey(candidate);
    return true;
  }

  async changePin(currentPin: string, newPin: string): Promise<UnlockResult> {
    if (!isValidPin(newPin)) throw new Error('PIN must be exactly 4 digits');
    this.requireKey();
    // Re-verify through the normal path so lockout applies to PIN changes too.
    const check = await this.unlockWithPin(currentPin);
    if (!check.ok) return check;
    const header = await wrapVaultKey(newPin, this.requireKey(), this.kdf);
    await this.store.setMeta({ [META_HEADER]: encodeHeader(header) });
    return { ok: true };
  }

  // ---- records ---------------------------------------------------------------------------

  async list(): Promise<ListedEntry[]> {
    const key = this.requireKey();
    const rows = await this.store.listRows();
    const out: ListedEntry[] = [];
    for (const r of rows) {
      const s = JSON.parse(utf8Decode(open(key, r.summary, summaryAad(r.id)))) as EntrySummary;
      out.push({ id: r.id, ...s });
    }
    return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }

  /** Secrets are decrypted one at a time, only when you actually look at them. */
  async getSecret(id: string): Promise<EntrySecret> {
    const key = this.requireKey();
    const r = await this.store.getRow(id);
    if (!r) throw new Error('Not found');
    return JSON.parse(utf8Decode(open(key, r.secret, secretAad(r.id)))) as EntrySecret;
  }

  async get(id: string): Promise<Entry> {
    const key = this.requireKey();
    const r = await this.store.getRow(id);
    if (!r) throw new Error('Not found');
    const s = JSON.parse(utf8Decode(open(key, r.summary, summaryAad(id)))) as EntrySummary;
    const x = JSON.parse(utf8Decode(open(key, r.secret, secretAad(id)))) as EntrySecret;
    return { id, ...s, ...x };
  }

  async save(input: EntryInput, id?: string): Promise<string> {
    const now = Date.now();
    let createdAt = now;
    if (id) {
      const existing = await this.get(id);
      createdAt = existing.createdAt;
    }
    const entry: Entry = { ...clean(input), id: id ?? newId(), createdAt, updatedAt: now };
    await this.store.putRow(this.encryptEntry(entry));
    return entry.id;
  }

  async remove(id: string): Promise<void> {
    this.requireKey();
    await this.store.deleteRow(id);
  }

  /** Everything, decrypted, for building a backup. Caller must drop it ASAP. */
  async exportAll(): Promise<Entry[]> {
    const rows = await this.store.listRows();
    return Promise.all(rows.map((r) => this.get(r.id)));
  }

  /**
   * Restore entries. "replace" swaps the vault contents in one transaction; "merge" keeps
   * existing entries and adds/overwrites by id.
   */
  async importEntries(entries: Entry[], mode: 'replace' | 'merge'): Promise<number> {
    this.requireKey();
    const rows = entries.map((e) => this.encryptEntry(e));
    if (mode === 'replace') {
      const meta: Record<string, Uint8Array> = {};
      for (const k of [META_HEADER, 'bio', 'canary']) {
        const v = await this.store.getMeta(k);
        if (v) meta[k] = v;
      }
      await this.store.replaceAll(meta, rows);
    } else {
      for (const r of rows) await this.store.putRow(r);
    }
    return rows.length;
  }

  /** Nuke it from orbit. Deleting the hardware key alone makes the old data unrecoverable. */
  async destroy(): Promise<void> {
    this.lock();
    await SecureNative.deleteDeviceKey();
    await SecureStore.deleteItemAsync(KV_BIO_KEY);
    await SecureStore.deleteItemAsync(KV_LAST_PIN);
    await SecureStore.deleteItemAsync(KV_LOCKOUT);
    await this.store.wipe();
    this.emit();
  }

  // ---- internals -------------------------------------------------------------------------

  private setKey(k: Uint8Array) {
    if (this.key && this.key !== k) wipe(this.key);
    this.key = k;
    this.emit();
  }

  private encryptEntry(e: Entry): EncryptedRow {
    const key = this.requireKey();
    const summary: EntrySummary = {
      title: e.title,
      username: e.username,
      url: e.url,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
    const secret: EntrySecret = { password: e.password, notes: e.notes };
    return {
      id: e.id,
      summary: seal(key, utf8Encode(JSON.stringify(summary)), summaryAad(e.id)),
      secret: seal(key, utf8Encode(JSON.stringify(secret)), secretAad(e.id)),
    };
  }

  /** A biometric-released key is only trusted if it decrypts something real. */
  private async verifyKey(candidate: Uint8Array): Promise<boolean> {
    const canary = await this.store.getMeta('canary');
    if (!canary) return false;
    try {
      open(candidate, canary, 'OV-CANARY-v1');
      return true;
    } catch {
      return false;
    }
  }

  private async markPinUnlock() {
    await SecureStore.setItemAsync(KV_LAST_PIN, String(Date.now()), DEVICE_ONLY);
    // Refresh the canary under the current key whenever the PIN proves who you are.
    if (this.key) await this.writeCanary(this.key);
  }

  private async writeCanary(key: Uint8Array) {
    await this.store.setMeta({ canary: seal(key, randomBytes(16), 'OV-CANARY-v1') });
  }

  private async requireMeta(k: string): Promise<Uint8Array> {
    const v = await this.store.getMeta(k);
    if (!v) throw new Error('Vault not initialized');
    return v;
  }

  private async loadLockout(): Promise<LockoutState> {
    const raw = await SecureStore.getItemAsync(KV_LOCKOUT, DEVICE_ONLY);
    const parsed = parseLockout(raw);
    // A corrupted record becomes a real lock, persisted so it actually expires.
    if (raw && JSON.stringify(parsed) !== raw) await this.saveLockout(parsed);
    return parsed;
  }

  private async saveLockout(s: LockoutState) {
    await SecureStore.setItemAsync(KV_LOCKOUT, JSON.stringify(s), DEVICE_ONLY);
  }
}

function newId(): string {
  return Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
}

const LIMITS = { title: 200, username: 500, url: 2000, password: 1000, notes: 10000 };

function clean(i: EntryInput): EntryInput {
  const cut = (s: string, n: number) => String(s ?? '').slice(0, n);
  return {
    title: cut(i.title, LIMITS.title).trim() || 'Untitled',
    username: cut(i.username, LIMITS.username),
    url: cut(i.url, LIMITS.url).trim(),
    password: cut(i.password, LIMITS.password),
    notes: cut(i.notes, LIMITS.notes),
  };
}
