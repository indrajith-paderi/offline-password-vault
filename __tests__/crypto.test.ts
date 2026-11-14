import { open, seal, DecryptError } from '../src/crypto/aead';
import { randomBytes, utf8Decode, utf8Encode } from '../src/crypto/bytes';
import { argon2id, assertSaneKdf } from '../src/crypto/kdf';
import { generatePassword } from '../src/crypto/generator';

const FAST = { ops: 2, memKiB: 19 * 1024 };

describe('aead', () => {
  let key: Uint8Array;
  beforeAll(() => {
    key = randomBytes(32);
  });

  it('round-trips and uses a fresh nonce every time', () => {
    const pt = utf8Encode('hunter2');
    const a = seal(key, pt, 'ctx');
    const b = seal(key, pt, 'ctx');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(utf8Decode(open(key, a, 'ctx'))).toBe('hunter2');
  });

  it('rejects the wrong AAD, the wrong key and any flipped bit', () => {
    const blob = seal(key, utf8Encode('x'), 'record|1');
    expect(() => open(key, blob, 'record|2')).toThrow(DecryptError);
    expect(() => open(randomBytes(32), blob, 'record|1')).toThrow(DecryptError);
    const evil = blob.slice();
    evil[14] ^= 1;
    expect(() => open(key, evil, 'record|1')).toThrow(DecryptError);
  });

  it('does not wipe the caller key', () => {
    const k = randomBytes(32);
    const copy = k.slice();
    seal(k, utf8Encode('x'), 'a');
    expect(k).toEqual(copy);
  });
});

describe('argon2id', () => {
  it('is deterministic per salt and differs across salts', () => {
    const s1 = randomBytes(16);
    const s2 = randomBytes(16);
    const pin = utf8Encode('1234');
    expect(argon2id(pin, s1, FAST)).toEqual(argon2id(pin, s1, FAST));
    expect(argon2id(pin, s1, FAST)).not.toEqual(argon2id(pin, s2, FAST));
  });

  it('refuses absurd parameters from untrusted files', () => {
    expect(() => assertSaneKdf({ ops: 1, memKiB: 1024 })).toThrow();
    expect(() => assertSaneKdf({ ops: 3, memKiB: 4 * 1024 * 1024 })).toThrow();
  });
});

describe('utf8', () => {
  it('handles emoji and accents', () => {
    const s = 'pässwörd 🔐 日本';
    expect(utf8Decode(utf8Encode(s))).toBe(s);
    expect(Buffer.from(utf8Encode(s)).toString('utf8')).toBe(s);
  });
});

describe('generator', () => {
  it('honours length and includes every chosen set', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword({ length: 16, lower: true, upper: true, digits: true, symbols: true });
      expect(p).toHaveLength(16);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[^a-zA-Z0-9]/);
    }
  });
});
