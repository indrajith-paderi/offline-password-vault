import SecureNative from '../../modules/secure-native';
import { utf8Encode } from './bytes';

export function seal(key: Uint8Array, plaintext: Uint8Array, aad: string | Uint8Array): Uint8Array {
  const aadBytes = typeof aad === 'string' ? utf8Encode(aad) : aad;
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
