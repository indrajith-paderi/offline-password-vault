import {
  attemptsLeft,
  beginAttempt,
  fail,
  INITIAL_LOCKOUT,
  lockRemainingMs,
  LOCK_MS,
  LockoutState,
  parseLockout,
  succeed,
} from '../src/vault/lockout';

const H = 60 * 60 * 1000;
const at = (wall: number, mono = wall, boot = 'b1') => ({ wall, mono, boot });

function wrong(state: LockoutState, now = at(0)) {
  return fail(beginAttempt(state, now), now);
}

describe('lockout', () => {
  it('locks for an hour after the third wrong PIN', () => {
    let s = wrong(INITIAL_LOCKOUT, at(0));
    s = wrong(s, at(1000));
    expect(attemptsLeft(s, at(2000))).toBe(1);
    s = wrong(s, at(2000));
    expect(attemptsLeft(s, at(2001))).toBe(0);
    expect(lockRemainingMs(s, at(2000))).toBe(LOCK_MS);
    expect(() => beginAttempt(s, at(2000 + H - 1))).toThrow();
    expect(attemptsLeft(s, at(2000 + H))).toBe(3);
  });

  it('forgets failures older than an hour', () => {
    let s = wrong(INITIAL_LOCKOUT, at(0));
    s = wrong(s, at(1));
    expect(attemptsLeft(s, at(H + 1))).toBe(3);
  });

  it('a success clears the counter', () => {
    let s = wrong(INITIAL_LOCKOUT, at(0));
    s = beginAttempt(s, at(1));
    s = succeed();
    expect(attemptsLeft(s, at(2))).toBe(3);
  });

  it('counts a guess even if the app dies mid-check', () => {
    let s = INITIAL_LOCKOUT;
    for (let i = 0; i < 3; i++) s = beginAttempt(s, at(i));
    expect(attemptsLeft(s, at(10))).toBe(0);
  });

  it('is not fooled by moving the wall clock forward on the same boot', () => {
    let s = INITIAL_LOCKOUT;
    for (let i = 0; i < 3; i++) s = wrong(s, at(i));
    const later = at(2 * H, 2 + 60_000);
    expect(lockRemainingMs(s, later)).toBeGreaterThan(0);
    expect(() => beginAttempt(s, later)).toThrow();
  });

  it('is not fooled by moving the wall clock backward', () => {
    let s = INITIAL_LOCKOUT;
    for (let i = 0; i < 3; i++) s = wrong(s, at(10 * H + i));
    expect(lockRemainingMs(s, at(0, 10 * H + 2 + H))).toBeGreaterThan(0);
  });

  it('fails closed on corrupted state', () => {
    const now = at(Date.now());
    expect(attemptsLeft(parseLockout('{not json', now), now)).toBe(0);
    expect(lockRemainingMs(parseLockout('{not json', now), now)).toBe(LOCK_MS);
  });
});
