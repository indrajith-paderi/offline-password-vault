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
    expect(() => beginAttempt(s, at(2000 + H - 1))).toThrow('Locked out');
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

  it('after a reboot falls back to the wall clock alone (documented limitation)', () => {
    let s = INITIAL_LOCKOUT;
    for (let i = 0; i < 3; i++) s = wrong(s, at(i));
    expect(lockRemainingMs(s, at(30 * 60 * 1000, 10, 'b2'))).toBe(LOCK_MS - 30 * 60 * 1000 + 2);
    expect(attemptsLeft(s, at(H + 2, 10, 'b2'))).toBe(3);
  });

  it('keeps counting failures across a reboot within the hour', () => {
    let s = wrong(INITIAL_LOCKOUT, at(0));
    s = wrong(s, at(1000));
    expect(attemptsLeft(s, at(2000, 5, 'b2'))).toBe(1);
  });

  it.each([
    ['fails is not an array', '{"fails":"x","lockedAt":null}', 3],
    ['stamps are malformed', '{"fails":[{"wall":"1"},{"wall":1,"mono":1}],"lockedAt":{"wall":1}}', 3],
    ['the record is empty', '{}', 3],
  ])('drops invalid parts when %s', (_label, json, left) => {
    const now = at(10);
    expect(attemptsLeft(parseLockout(json, now), now)).toBe(left);
  });

  it('keeps valid stamps from a partially valid record', () => {
    const now = at(10);
    const json = JSON.stringify({ fails: [at(1), { wall: 'x' }, at(2)], lockedAt: null });
    expect(attemptsLeft(parseLockout(json, now), now)).toBe(1);
  });

  it('treats a missing record as a clean slate', () => {
    const now = at(10);
    expect(parseLockout(null, now)).toEqual(INITIAL_LOCKOUT);
    expect(parseLockout('', now)).toEqual(INITIAL_LOCKOUT);
  });

  it.each([
    ['a string wall time', { wall: '1', mono: 1, boot: 'b1' }],
    ['a string monotonic time', { wall: 1, mono: '1', boot: 'b1' }],
    ['a numeric boot id', { wall: 1, mono: 1, boot: 1 }],
  ])('discards a stamp with %s', (_label, stamp) => {
    const now = at(10);
    const parsed = parseLockout(JSON.stringify({ fails: [stamp], lockedAt: stamp }), now);
    expect(parsed).toEqual(INITIAL_LOCKOUT);
  });

  it('a lock caused by corruption expires cleanly with all attempts restored', () => {
    const now = at(10);
    const s = parseLockout('{not json', now);
    expect(s.fails).toEqual([]);
    expect(attemptsLeft(s, at(10 + LOCK_MS))).toBe(3);
  });
});
