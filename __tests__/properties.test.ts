import fc from 'fast-check';
import { createBackup, openBackup } from '../src/backup/format';
import { fromBase64, toBase64, utf8Decode, utf8Encode } from '../src/crypto/bytes';
import { generatePassword } from '../src/crypto/generator';
import { decodeHeader, encodeHeader } from '../src/vault/keys';
import { beginAttempt, Clock, fail, INITIAL_LOCKOUT, LOCK_MS, LockoutState, MAX_ATTEMPTS } from '../src/vault/lockout';
import type { Entry } from '../src/vault/types';
import { FAST_KDF, HOUR } from './helpers';

const utf16 = fc.string({ unit: fc.integer({ min: 0, max: 0xffff }).map((n) => String.fromCharCode(n)), maxLength: 64 });

describe('utf8', () => {
  it('encodes exactly like Node for any UTF-16 string, including lone surrogates', () => {
    fc.assert(
      fc.property(utf16, (s) => {
        expect(Buffer.from(utf8Encode(s)).equals(Buffer.from(s, 'utf8'))).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  it('round-trips every well-formed string', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 64 }), (s) => {
        expect(utf8Decode(utf8Encode(s))).toBe(s);
      }),
      { numRuns: 2000 },
    );
  });

  it('decodes arbitrary bytes exactly like Node, never throwing', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (b) => {
        expect(utf8Decode(b)).toBe(Buffer.from(b).toString('utf8'));
      }),
      { numRuns: 5000 },
    );
  });

  it('handles the classic malformed cases', () => {
    const cases = ['c0af', 'e080af', 'eda080', 'f4908080', 'f8888080af', 'e282', 'ff', 'c2', 'f09f98'];
    for (const h of cases) {
      const b = Buffer.from(h, 'hex');
      expect(utf8Decode(new Uint8Array(b))).toBe(b.toString('utf8'));
    }
  });
});

describe('base64', () => {
  it('round-trips arbitrary bytes and matches Node', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 128 }), (b) => {
        const s = toBase64(b);
        expect(s).toBe(Buffer.from(b).toString('base64'));
        expect(fromBase64(s)).toEqual(b);
      }),
    );
  });
});

describe('password generator', () => {
  const opts = fc.record({
    length: fc.integer({ min: 0, max: 80 }),
    lower: fc.boolean(),
    upper: fc.boolean(),
    digits: fc.boolean(),
    symbols: fc.boolean(),
  });

  it('honours every option combination', () => {
    fc.assert(
      fc.property(opts, (o) => {
        const sets = [o.lower, o.upper, o.digits, o.symbols].filter(Boolean).length;
        if (sets === 0) {
          expect(() => generatePassword(o)).toThrow();
          return;
        }
        const p = generatePassword(o);
        expect(p.length).toBe(Math.max(o.length, sets, 8));
        expect(/[a-z]/.test(p)).toBe(o.lower);
        expect(/[A-Z]/.test(p)).toBe(o.upper);
        expect(/[0-9]/.test(p)).toBe(o.digits);
        expect(/[^A-Za-z0-9]/.test(p)).toBe(o.symbols);
        expect(p).not.toMatch(/[0O1lI]/);
      }),
      { numRuns: 500 },
    );
  });

  it('does not favour any character', () => {
    const counts = new Map<string, number>();
    const n = 2000;
    for (let i = 0; i < n; i++) {
      for (const c of generatePassword({ length: 20, lower: false, upper: false, digits: true, symbols: false })) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    const expected = (n * 20) / 8;
    expect(counts.size).toBe(8);
    for (const v of counts.values()) expect(Math.abs(v - expected) / expected).toBeLessThan(0.08);
  });
});

describe('vault header', () => {
  it('encodes and decodes any header', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.uint8Array({ minLength: 16, maxLength: 16 }),
        fc.uint8Array({ minLength: 28, maxLength: 100 }),
        (ops, memKiB, salt, wrappedKey) => {
          const h = { version: 1, kdf: { ops, memKiB }, salt, wrappedKey };
          expect(decodeHeader(encodeHeader(h))).toEqual(h);
        },
      ),
    );
  });

  it('rejects any byte string that is too short or the wrong version', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 120 }), (b) => {
        const plausible = b.length >= 1 + 8 + 16 + 28 && b[0] === 1;
        if (plausible) expect(() => decodeHeader(b)).not.toThrow();
        else expect(() => decodeHeader(b)).toThrow('Unsupported vault header');
      }),
      { numRuns: 1000 },
    );
  });
});

describe('lockout model', () => {
  type Step =
    | { kind: 'guess' }
    | { kind: 'wait'; ms: number }
    | { kind: 'wallJump'; ms: number };

  const step: fc.Arbitrary<Step> = fc.oneof(
    { weight: 5, arbitrary: fc.constant<Step>({ kind: 'guess' }) },
    { weight: 3, arbitrary: fc.integer({ min: 1, max: 2 * HOUR }).map<Step>((ms) => ({ kind: 'wait', ms })) },
    { weight: 2, arbitrary: fc.integer({ min: -48 * HOUR, max: 48 * HOUR }).map<Step>((ms) => ({ kind: 'wallJump', ms })) },
  );

  it('never allows more than 3 wrong guesses per rolling monotonic hour on one boot, whatever the wall clock does', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 80 }), (steps) => {
        let now: Clock = { wall: 1_700_000_000_000, mono: 1_000_000, boot: 'b' };
        let state: LockoutState = INITIAL_LOCKOUT;
        const accepted: number[] = [];
        for (const s of steps) {
          if (s.kind === 'wait') now = { ...now, wall: now.wall + s.ms, mono: now.mono + s.ms };
          else if (s.kind === 'wallJump') now = { ...now, wall: now.wall + s.ms };
          else {
            try {
              state = beginAttempt(state, now);
            } catch {
              continue;
            }
            accepted.push(now.mono);
            state = fail(state, now);
          }
        }
        for (const m of accepted) {
          const inWindow = accepted.filter((x) => x > m - LOCK_MS && x <= m).length;
          expect(inWindow).toBeLessThanOrEqual(MAX_ATTEMPTS);
        }
      }),
      { numRuns: 1000 },
    );
  });
});

describe('backup round trip', () => {
  const field = (max: number) => fc.string({ unit: 'binary', maxLength: Math.min(max, 40) });
  const entry: fc.Arbitrary<Entry> = fc.record({
    id: fc.stringMatching(/^[A-Za-z0-9_-]{1,32}$/),
    title: field(200),
    username: field(500),
    url: field(2000),
    password: field(1000),
    notes: field(10000),
    createdAt: fc.integer({ min: 0, max: 2 ** 47 }),
    updatedAt: fc.integer({ min: 0, max: 2 ** 47 }),
  });
  const entries = fc.uniqueArray(entry, { selector: (e) => e.id, maxLength: 6 });

  it('restores exactly what was exported', () => {
    fc.assert(
      fc.property(entries, fc.string({ minLength: 1, maxLength: 40 }), fc.integer({ min: 0, max: 2 ** 47 }), (es, pw, now) => {
        const file = createBackup(es, pw, { appVersion: '1.0.0', now, kdf: FAST_KDF });
        const out = openBackup(file, pw);
        expect(out.entries).toEqual(es);
        expect(out.info.createdAt).toBe(now);
      }),
      { numRuns: 12 },
    );
  });
});
