import SecureNative from '../../modules/secure-native';
import { open, seal } from '../crypto/aead';
import { concat, randomBytes, u32be, utf8Encode, wipe } from '../crypto/bytes';
import { argon2id, KdfParams, KEY_BYTES, SALT_BYTES, VAULT_KDF } from '../crypto/kdf';

export const HEADER_VERSION = 1;
const KEK_CONTEXT = utf8Encode('OV-KEK-v1');
const VK_CONTEXT = utf8Encode('OV-VK-v1');

export const PIN_PATTERN = /^\d{4}$/;

export type VaultHeader = {
  version: number;
  kdf: KdfParams;
  salt: Uint8Array;
  wrappedKey: Uint8Array;
};

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

function headerAad(version: number, kdf: KdfParams, salt: Uint8Array): Uint8Array {
  return concat(VK_CONTEXT, Uint8Array.of(version), u32be(kdf.ops), u32be(kdf.memKiB), salt);
}

export async function deriveKek(pin: string, salt: Uint8Array, kdf: KdfParams): Promise<Uint8Array> {
  if (!isValidPin(pin)) throw new Error('PIN must be exactly 4 digits');
  const pinBytes = utf8Encode(pin);
  const pinHash = argon2id(pinBytes, salt, kdf);
  try {
    return await SecureNative.deviceMac(concat(KEK_CONTEXT, salt, pinHash));
  } finally {
    wipe(pinBytes, pinHash);
  }
}

export function newVaultKey(): Uint8Array {
  return randomBytes(KEY_BYTES);
}

export async function wrapVaultKey(
  pin: string,
  vaultKey: Uint8Array,
  kdf: KdfParams = VAULT_KDF,
): Promise<VaultHeader> {
  const salt = randomBytes(SALT_BYTES);
  const kek = await deriveKek(pin, salt, kdf);
  try {
    const wrappedKey = seal(kek, vaultKey, headerAad(HEADER_VERSION, kdf, salt));
    return { version: HEADER_VERSION, kdf, salt, wrappedKey };
  } finally {
    wipe(kek);
  }
}

export async function unwrapVaultKey(pin: string, h: VaultHeader): Promise<Uint8Array> {
  const kek = await deriveKek(pin, h.salt, h.kdf);
  try {
    return open(kek, h.wrappedKey, headerAad(h.version, h.kdf, h.salt));
  } finally {
    wipe(kek);
  }
}

export function encodeHeader(h: VaultHeader): Uint8Array {
  return concat(Uint8Array.of(h.version), u32be(h.kdf.ops), u32be(h.kdf.memKiB), h.salt, h.wrappedKey);
}

export function decodeHeader(b: Uint8Array): VaultHeader {
  if (b.length < 1 + 8 + SALT_BYTES + 28 || b[0] !== HEADER_VERSION) {
    throw new Error('Unsupported vault header');
  }
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return {
    version: b[0],
    kdf: { ops: dv.getUint32(1, false), memKiB: dv.getUint32(5, false) },
    salt: b.slice(9, 9 + SALT_BYTES),
    wrappedKey: b.slice(9 + SALT_BYTES),
  };
}
