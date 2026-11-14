import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

let deviceKey = randomBytes(32);
let mono = 1_000_000;
let boot = 'boot-1';

const SecureNative = {
  async deviceMac(data: Uint8Array) {
    return new Uint8Array(createHmac('sha256', deviceKey).update(data).digest());
  },
  async deviceKeySecurityLevel() {
    return 'tee';
  },
  async deleteDeviceKey() {
    deviceKey = randomBytes(32);
  },
  aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array, aad: Uint8Array) {
    if (key.length !== 32) throw new Error('ERR_KEY');
    const nonce = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, nonce);
    c.setAAD(aad);
    const ct = Buffer.concat([c.update(plaintext), c.final()]);
    return new Uint8Array(Buffer.concat([nonce, ct, c.getAuthTag()]));
  },
  aesGcmDecrypt(key: Uint8Array, blob: Uint8Array, aad: Uint8Array) {
    if (key.length !== 32 || blob.length < 28) throw new Error('ERR_DECRYPT');
    const b = Buffer.from(blob);
    const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12));
    d.setAAD(aad);
    d.setAuthTag(b.subarray(b.length - 16));
    return new Uint8Array(Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]));
  },
  monotonicMs: () => mono,
  bootId: () => boot,
  async copySensitive() {},
  async clearClipboard() {},
  integrityReport: () => ({
    debuggerAttached: false,
    debuggable: false,
    compromised: false,
    signingCertSha256: null,
    installer: null,
  }),
};

export const __test = {
  resetDevice() {
    deviceKey = randomBytes(32);
  },
  setClock(m: number, b = boot) {
    mono = m;
    boot = b;
  },
};

export default SecureNative;
