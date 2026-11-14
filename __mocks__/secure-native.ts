import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import type { DeviceKeyLevel, IntegrityReport } from '../modules/secure-native/src/SecureNative.types';

type Clip = { text: string; sensitive: true; expiresAt: number };

type State = {
  deviceKey: Buffer | null;
  hardwareAvailable: boolean;
  level: DeviceKeyLevel;
  mono: number;
  boot: string;
  bootCount: number;
  clipboard: Clip | null;
  integrity: IntegrityReport;
  calls: Record<string, number>;
};

const GCM_NONCE = 12;
const GCM_TAG = 16;

function fresh(): State {
  return {
    deviceKey: null,
    hardwareAvailable: true,
    level: 'tee',
    mono: 1_000_000,
    boot: 'boot-1',
    bootCount: 1,
    clipboard: null,
    integrity: {
      debuggerAttached: false,
      debuggable: false,
      compromised: false,
      signingCertSha256: null,
      installer: null,
    },
    calls: {},
  };
}

let state = fresh();

function coded(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function track(name: string) {
  state.calls[name] = (state.calls[name] ?? 0) + 1;
}

function bytes(name: string, v: unknown): Uint8Array {
  if (!(v instanceof Uint8Array)) throw new TypeError(`${name} must be a Uint8Array`);
  return v;
}

function key32(v: unknown): Uint8Array {
  const k = bytes('key', v);
  if (k.length !== 32) throw coded('ERR_KEY', 'Key must be 32 bytes');
  return k;
}

function hardwareKey(): Buffer {
  if (!state.hardwareAvailable) throw coded('ERR_KEYSTORE', 'Keystore unavailable');
  if (!state.deviceKey) state.deviceKey = randomBytes(32);
  return state.deviceKey;
}

const SecureNative = {
  async deviceMac(data: Uint8Array): Promise<Uint8Array> {
    track('deviceMac');
    const input = bytes('data', data);
    const key = hardwareKey();
    try {
      return new Uint8Array(createHmac('sha256', key).update(input).digest());
    } finally {
      input.fill(0);
    }
  },

  async deviceKeySecurityLevel(): Promise<DeviceKeyLevel> {
    track('deviceKeySecurityLevel');
    hardwareKey();
    return state.level;
  },

  async deleteDeviceKey(): Promise<void> {
    track('deleteDeviceKey');
    state.deviceKey = null;
  },

  aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array {
    track('aesGcmEncrypt');
    const k = key32(key);
    const pt = bytes('plaintext', plaintext);
    const a = bytes('aad', aad);
    try {
      const nonce = randomBytes(GCM_NONCE);
      const c = createCipheriv('aes-256-gcm', k, nonce);
      c.setAAD(a);
      const ct = Buffer.concat([c.update(pt), c.final()]);
      return new Uint8Array(Buffer.concat([nonce, ct, c.getAuthTag()]));
    } finally {
      k.fill(0);
      pt.fill(0);
    }
  },

  aesGcmDecrypt(key: Uint8Array, blob: Uint8Array, aad: Uint8Array): Uint8Array {
    track('aesGcmDecrypt');
    const k = key32(key);
    const b = Buffer.from(bytes('blob', blob));
    const a = bytes('aad', aad);
    try {
      if (b.length < GCM_NONCE + GCM_TAG) throw coded('ERR_DECRYPT', 'Authentication failed');
      const d = createDecipheriv('aes-256-gcm', k, b.subarray(0, GCM_NONCE));
      d.setAAD(a);
      d.setAuthTag(b.subarray(b.length - GCM_TAG));
      try {
        return new Uint8Array(Buffer.concat([d.update(b.subarray(GCM_NONCE, b.length - GCM_TAG)), d.final()]));
      } catch {
        throw coded('ERR_DECRYPT', 'Authentication failed');
      }
    } finally {
      k.fill(0);
    }
  },

  monotonicMs(): number {
    return state.mono;
  },

  bootId(): string {
    return state.boot;
  },

  async copySensitive(text: string, expiresInMs: number): Promise<void> {
    track('copySensitive');
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    if (!Number.isFinite(expiresInMs) || expiresInMs <= 0) throw new TypeError('expiresInMs must be positive');
    state.clipboard = { text, sensitive: true, expiresAt: state.mono + expiresInMs };
  },

  async clearClipboard(): Promise<void> {
    track('clearClipboard');
    state.clipboard = null;
  },

  integrityReport(): IntegrityReport {
    return { ...state.integrity };
  },
};

export const nativeControl = {
  reset() {
    state = fresh();
  },
  newDevice() {
    state.deviceKey = null;
    state.clipboard = null;
    state.mono = 1_000_000;
    state.bootCount += 1;
    state.boot = `other-device-boot-${state.bootCount}`;
  },
  setHardwareAvailable(v: boolean) {
    state.hardwareAvailable = v;
  },
  setLevel(level: DeviceKeyLevel) {
    state.level = level;
  },
  setIntegrity(patch: Partial<IntegrityReport>) {
    state.integrity = { ...state.integrity, ...patch };
  },
  advanceMono(ms: number) {
    state.mono += ms;
  },
  reboot() {
    state.bootCount += 1;
    state.boot = `boot-${state.bootCount}`;
    state.mono = 5_000;
  },
  get clock() {
    return { mono: state.mono, boot: state.boot };
  },
  get clipboard(): Clip | null {
    return state.clipboard ? { ...state.clipboard } : null;
  },
  get hasDeviceKey() {
    return state.deviceKey !== null;
  },
  calls(name: string) {
    return state.calls[name] ?? 0;
  },
};

export default SecureNative;
