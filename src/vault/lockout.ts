/**
 * "3 wrong PINs within an hour -> locked for an hour."
 *
 * Wall-clock time alone is trivially gamed (Settings > Date & time), so every timestamp is
 * paired with a monotonic clock reading and a boot id. Within one boot, both clocks must
 * agree that the time has passed. Across a reboot only the wall clock is left; that gap is
 * documented in SECURITY.md rather than papered over.
 */

export const MAX_ATTEMPTS = 3;
export const WINDOW_MS = 60 * 60 * 1000;
export const LOCK_MS = 60 * 60 * 1000;

export type Clock = { wall: number; mono: number; boot: string };
type Stamp = Clock;

export type LockoutState = {
  fails: Stamp[];
  lockedAt: Stamp | null;
};

export const INITIAL_LOCKOUT: LockoutState = { fails: [], lockedAt: null };

/** Has `ms` passed since `s`? Both clocks must agree while we're still on the same boot. */
function elapsed(s: Stamp, now: Clock, ms: number): boolean {
  const wallOk = now.wall - s.wall >= ms;
  if (now.boot !== s.boot) return wallOk;
  return wallOk && now.mono - s.mono >= ms;
}

function remaining(s: Stamp, now: Clock, ms: number): number {
  const byWall = s.wall + ms - now.wall;
  const byMono = now.boot === s.boot ? s.mono + ms - now.mono : 0;
  return Math.max(0, byWall, byMono);
}

/** Expire old failures, apply a lock if the window is full, clear a finished lock. */
export function normalize(state: LockoutState, now: Clock): LockoutState {
  let { fails, lockedAt } = state;
  if (lockedAt && elapsed(lockedAt, now, LOCK_MS)) lockedAt = null;
  fails = fails.filter((f) => !elapsed(f, now, WINDOW_MS));
  if (!lockedAt && fails.length >= MAX_ATTEMPTS) {
    lockedAt = now;
    fails = [];
  }
  return { fails, lockedAt };
}

export function lockRemainingMs(state: LockoutState, now: Clock): number {
  const s = normalize(state, now);
  return s.lockedAt ? remaining(s.lockedAt, now, LOCK_MS) : 0;
}

export function attemptsLeft(state: LockoutState, now: Clock): number {
  const s = normalize(state, now);
  return s.lockedAt ? 0 : MAX_ATTEMPTS - s.fails.length;
}

/**
 * Call BEFORE checking the PIN and persist the result. If the app is killed mid-check,
 * the guess still counts. On success, call `succeed` to clear it.
 */
export function beginAttempt(state: LockoutState, now: Clock): LockoutState {
  const s = normalize(state, now);
  if (s.lockedAt) throw new Error('Locked out');
  return { ...s, fails: [...s.fails, now] };
}

/** After a wrong PIN: the failure is already recorded, just apply the lock if earned. */
export function fail(state: LockoutState, now: Clock): LockoutState {
  return normalize(state, now);
}

export function succeed(): LockoutState {
  return INITIAL_LOCKOUT;
}

export function parseLockout(json: string | null): LockoutState {
  if (!json) return INITIAL_LOCKOUT;
  try {
    const v = JSON.parse(json);
    const okStamp = (s: unknown): s is Stamp =>
      !!s &&
      typeof (s as Stamp).wall === 'number' &&
      typeof (s as Stamp).mono === 'number' &&
      typeof (s as Stamp).boot === 'string';
    return {
      fails: Array.isArray(v.fails) ? v.fails.filter(okStamp) : [],
      lockedAt: okStamp(v.lockedAt) ? v.lockedAt : null,
    };
  } catch {
    // Corrupted state fails closed: treat it as a fresh lock rather than a free reset.
    return { fails: [], lockedAt: { wall: Date.now(), mono: 0, boot: 'corrupt' } };
  }
}
