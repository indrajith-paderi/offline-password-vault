import sodium from 'react-native-libsodium';

export type KdfParams = {
  ops: number;
  memKiB: number;
};

export const VAULT_KDF: KdfParams = { ops: 3, memKiB: 64 * 1024 };

export const BACKUP_KDF: KdfParams = { ops: 4, memKiB: 128 * 1024 };

export const SALT_BYTES = 16;
export const KEY_BYTES = 32;

export const KDF_LIMITS = { minOps: 2, maxOps: 10, minMemKiB: 19 * 1024, maxMemKiB: 512 * 1024 };

export function assertSaneKdf(p: KdfParams): void {
  if (
    !Number.isInteger(p.ops) ||
    !Number.isInteger(p.memKiB) ||
    p.ops < KDF_LIMITS.minOps ||
    p.ops > KDF_LIMITS.maxOps ||
    p.memKiB < KDF_LIMITS.minMemKiB ||
    p.memKiB > KDF_LIMITS.maxMemKiB
  ) {
    throw new Error('Unsupported key-derivation parameters');
  }
}

export function argon2id(secret: Uint8Array, salt: Uint8Array, p: KdfParams): Uint8Array {
  assertSaneKdf(p);
  if (salt.length !== SALT_BYTES) throw new Error('Bad salt');
  return sodium.crypto_pwhash(
    KEY_BYTES,
    secret,
    salt,
    p.ops,
    p.memKiB * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
