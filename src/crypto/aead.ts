import SecureNative from '../../modules/secure-native';
import { utf8Encode } from './bytes';

/**
 * AES-256-GCM through the platform's own crypto (JCA on Android, CryptoKit on iOS).
 * Blob layout: nonce(12) || ciphertext || tag(16). AAD binds each blob to its context,
 * so a ciphertext can't be cut from one record and pasted into another.
 */
export function seal(key: Uint8Array, plaintext: Uint8Array, aad: string | Uint8Array): Uint8Array {
  const aadBytes = typeof aad === 'string' ? utf8Encode(aad) : aad;
  // The bridge copies arguments, and native wipes its copies. We pass copies so callers keep theirs.
  return SecureNative.aesGcmEncrypt(key.slice(), plaintext.slice(), aadBytes);
}

export class DecryptError extends Error {
  constructor() {
    super('Decryption failed');
    this.name = 'DecryptError';
  }
}

export function open(key: Uint8Array, blob: Uint8Array, aad: string | Uint8Array): Uint8Array {
  const aadBytes = typeof aad === 'string' ? utf8Encode(aad) : aad;
  try {
    return SecureNative.aesGcmDecrypt(key.slice(), blob, aadBytes);
  } catch {
    throw new DecryptError();
  }
}
