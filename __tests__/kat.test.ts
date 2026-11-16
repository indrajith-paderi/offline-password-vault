import { argon2id as nobleArgon2id } from '@noble/hashes/argon2.js';
import fc from 'fast-check';
import vectors from '../modules/secure-native/test-vectors/aes-gcm.json';
import { DecryptError, open, seal } from '../src/crypto/aead';
import { concat, utf8Encode } from '../src/crypto/bytes';
import { argon2id, BACKUP_KDF, KDF_LIMITS, VAULT_KDF } from '../src/crypto/kdf';
import { FAST_KDF, hex, unhex } from './helpers';

describe('Argon2id known answers', () => {
  const pinned = [
    { pw: '1234', salt: '07'.repeat(16), ops: 2, memKiB: 19 * 1024, out: 'ccdba260ebb6d611a0a90347637f612d15d15625b28693b5b0c4ad4942768807' },
  ];

  it.each(pinned)('matches the pinned output for $pw', ({ pw, salt, ops, memKiB, out }) => {
    expect(hex(argon2id(utf8Encode(pw), unhex(salt), { ops, memKiB }))).toBe(out);
  });

  it('agrees with an independent implementation (noble-hashes)', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ maxLength: 32 }),
        fc.uint8Array({ minLength: 16, maxLength: 16 }),
        fc.integer({ min: KDF_LIMITS.minOps, max: 3 }),
        (pw, salt, ops) => {
          const memKiB = FAST_KDF.memKiB;
          const ours = argon2id(pw, salt, { ops, memKiB });
          const theirs = nobleArgon2id(pw, salt, { t: ops, m: memKiB, p: 1, dkLen: 32 });
          expect(hex(ours)).toBe(hex(theirs));
        },
      ),
      { numRuns: 6 },
    );
  });

  it('uses parameters at or above OWASP minimums', () => {
    for (const p of [VAULT_KDF, BACKUP_KDF]) {
      expect(p.memKiB).toBeGreaterThanOrEqual(19 * 1024);
      expect(p.ops).toBeGreaterThanOrEqual(2);
    }
    expect(BACKUP_KDF.memKiB * BACKUP_KDF.ops).toBeGreaterThan(VAULT_KDF.memKiB * VAULT_KDF.ops);
  });

  it('rejects a salt that is not 16 bytes', () => {
    expect(() => argon2id(utf8Encode('x'), new Uint8Array(15), FAST_KDF)).toThrow('salt');
    expect(() => argon2id(utf8Encode('x'), new Uint8Array(17), FAST_KDF)).toThrow('salt');
  });
});

describe('AES-256-GCM known answers and blob layout', () => {
  it.each(vectors.vectors)('$name opens from nonce || ciphertext || tag', (v) => {
    const blob = concat(unhex(v.nonce), unhex(v.ciphertext), unhex(v.tag));
    expect(hex(open(unhex(v.key), blob, unhex(v.aad)))).toBe(v.plaintext);
  });

  it.each(vectors.vectors)('$name fails with a flipped tag bit', (v) => {
    const blob = concat(unhex(v.nonce), unhex(v.ciphertext), unhex(v.tag));
    blob[blob.length - 1] ^= 1;
    expect(() => open(unhex(v.key), blob, unhex(v.aad))).toThrow(DecryptError);
  });

  it('produces 12 + n + 16 bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (pt) => {
        expect(seal(new Uint8Array(32), pt, 'x').length).toBe(12 + pt.length + 16);
      }),
    );
  });

  it('never repeats a nonce across 10k encryptions', () => {
    const key = new Uint8Array(32);
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(hex(seal(key, new Uint8Array(1), 'x').subarray(0, 12)));
    expect(seen.size).toBe(10_000);
  });

  it('rejects blobs shorter than nonce + tag', () => {
    for (let n = 0; n < 28; n++) expect(() => open(new Uint8Array(32), new Uint8Array(n), 'x')).toThrow(DecryptError);
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => seal(new Uint8Array(16), new Uint8Array(1), 'x')).toThrow();
    expect(() => seal(new Uint8Array(33), new Uint8Array(1), 'x')).toThrow();
  });
});

describe('vault key wrapping defaults', () => {
  it('uses the production vault KDF when none is given', async () => {
    const { wrapVaultKey, unwrapVaultKey } = await import('../src/vault/keys');
    const key = new Uint8Array(32).fill(3);
    const header = await wrapVaultKey('4821', key);
    expect(header.kdf).toEqual(VAULT_KDF);
    expect(await unwrapVaultKey('4821', header)).toEqual(key);
  });
});
