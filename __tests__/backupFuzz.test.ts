import fc from 'fast-check';
import {
  BackupFormatError,
  createBackup,
  openBackup,
  readBackupInfo,
  WrongBackupPasswordError,
} from '../src/backup/format';
import type { Entry } from '../src/vault/types';
import { FAST_KDF } from './helpers';

const PW = 'Fuzz-Passw0rd!';
const entry: Entry = {
  id: 'e1',
  title: 't',
  username: 'u',
  url: '',
  password: 'p',
  notes: '',
  createdAt: 1,
  updatedAt: 2,
};

let valid: Uint8Array;

beforeAll(() => {
  valid = createBackup([entry], PW, { appVersion: '1.0.0', now: 1, kdf: FAST_KDF });
});

function expectOnlyKnownErrors(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    expect(e instanceof BackupFormatError || e instanceof WrongBackupPasswordError).toBe(true);
  }
}

const mutation = fc.oneof(
  fc.record({ kind: fc.constant('flip' as const), at: fc.nat(), bit: fc.integer({ min: 0, max: 7 }) }),
  fc.record({ kind: fc.constant('truncate' as const), at: fc.nat() }),
  fc.record({ kind: fc.constant('insert' as const), at: fc.nat(), bytes: fc.uint8Array({ minLength: 1, maxLength: 8 }) }),
  fc.record({ kind: fc.constant('set' as const), at: fc.nat(), value: fc.integer({ min: 0, max: 255 }) }),
);

type Mutation = typeof mutation extends fc.Arbitrary<infer T> ? T : never;

function apply(src: Uint8Array, ms: Mutation[]): Uint8Array {
  let b = Uint8Array.from(src);
  for (const m of ms) {
    const at = b.length ? m.at % b.length : 0;
    if (m.kind === 'flip' && b.length) b[at] ^= 1 << m.bit;
    else if (m.kind === 'set' && b.length) b[at] = m.value;
    else if (m.kind === 'truncate') b = b.slice(0, at);
    else if (m.kind === 'insert') b = Uint8Array.from([...b.slice(0, at), ...m.bytes, ...b.slice(at)]);
  }
  return b;
}

const sameKdf = (b: Uint8Array) => {
  try {
    const k = readBackupInfo(b).kdf;
    return k.ops === FAST_KDF.ops && k.memKiB === FAST_KDF.memKiB;
  } catch {
    return false;
  }
};

describe('backup parser fuzzing', () => {
  it('readBackupInfo only ever throws BackupFormatError on random bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 200 }), (b) => {
        try {
          readBackupInfo(b);
        } catch (e) {
          expect(e).toBeInstanceOf(BackupFormatError);
        }
      }),
      { numRuns: 3000 },
    );
  });

  it('readBackupInfo only ever throws BackupFormatError on random bytes behind a valid magic', () => {
    const magic = Uint8Array.from([0x4f, 0x56, 0x42, 0x4b, 1, 2]);
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 120 }), (tail) => {
        try {
          readBackupInfo(Uint8Array.from([...magic, ...tail]));
        } catch (e) {
          expect(e).toBeInstanceOf(BackupFormatError);
        }
      }),
      { numRuns: 3000 },
    );
  });

  it('any mutation of a valid file is rejected with a known error', () => {
    fc.assert(
      fc.property(fc.array(mutation, { minLength: 1, maxLength: 4 }), (ms) => {
        const b = apply(valid, ms);
        if (Buffer.from(b).equals(Buffer.from(valid))) return;
        expectOnlyKnownErrors(() => readBackupInfo(b));
        if (!sameKdf(b)) return;
        expect(() => openBackup(b, PW)).toThrow();
        expectOnlyKnownErrors(() => openBackup(b, PW));
      }),
      { numRuns: 60 },
    );
  });

  it('a truncated file never decrypts', () => {
    for (let n = 0; n < valid.length; n += 7) {
      expectOnlyKnownErrors(() => openBackup(valid.slice(0, n), PW));
      if (sameKdf(valid.slice(0, n))) expect(() => openBackup(valid.slice(0, n), PW)).toThrow();
    }
  });
});

describe('authenticated but hostile payloads', () => {
  const hostile: [string, unknown[]][] = [
    ['a non-object entry', [42]],
    ['a missing field', [{ ...entry, password: undefined }]],
    ['a numeric title', [{ ...entry, title: 7 }]],
    ['an oversized note', [{ ...entry, notes: 'x'.repeat(10_001) }]],
    ['an id with path characters', [{ ...entry, id: '../../etc' }]],
    ['an empty id', [{ ...entry, id: '' }]],
    ['a non-finite timestamp', [{ ...entry, createdAt: 'yesterday' }]],
    ['duplicate ids', [entry, { ...entry }]],
  ];

  it.each(hostile)('rejects %s', (_label, entries) => {
    const file = createBackup(entries as Entry[], PW, { appVersion: '1', kdf: FAST_KDF });
    expect(() => openBackup(file, PW)).toThrow(BackupFormatError);
  });

  it('drops unknown fields such as __proto__ instead of copying them', () => {
    const sneaky = JSON.parse(JSON.stringify({ ...entry, extra: 1 }).replace('"extra":1', '"__proto__":{"polluted":true}'));
    const file = createBackup([sneaky] as Entry[], PW, { appVersion: '1', kdf: FAST_KDF });
    const [out] = openBackup(file, PW).entries;
    expect(Object.keys(out).sort()).toEqual(Object.keys(entry).sort());
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects a backup whose KDF parameters would exhaust memory before deriving', () => {
    const b = Uint8Array.from(valid);
    new DataView(b.buffer).setUint32(10, 0xffffffff);
    expect(() => openBackup(b, PW)).toThrow(BackupFormatError);
  });
});
