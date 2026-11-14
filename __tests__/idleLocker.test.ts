import { IdleLocker } from '../src/security/idleLocker';

function setup(idleMs = 60_000) {
  jest.useFakeTimers();
  const onLock = jest.fn();
  return { locker: new IdleLocker(idleMs, onLock), onLock };
}

describe('IdleLocker', () => {
  it('locks after the idle period and not a millisecond earlier', () => {
    const { locker, onLock } = setup(30_000);
    locker.start();
    jest.advanceTimersByTime(29_999);
    expect(onLock).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on activity', () => {
    const { locker, onLock } = setup(30_000);
    locker.start();
    jest.advanceTimersByTime(20_000);
    locker.poke();
    jest.advanceTimersByTime(20_000);
    expect(onLock).not.toHaveBeenCalled();
    jest.advanceTimersByTime(10_000);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('locks immediately when the app goes to the background', () => {
    const { locker, onLock } = setup();
    locker.start();
    locker.appStateChanged('inactive');
    expect(onLock).not.toHaveBeenCalled();
    locker.appStateChanged('background');
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('fires once, then stays quiet until restarted', () => {
    const { locker, onLock } = setup(1_000);
    locker.start();
    jest.advanceTimersByTime(1_000);
    locker.appStateChanged('background');
    locker.poke();
    jest.advanceTimersByTime(10_000);
    expect(onLock).toHaveBeenCalledTimes(1);
    expect(locker.isActive).toBe(false);
  });

  it('does nothing while stopped', () => {
    const { locker, onLock } = setup(1_000);
    locker.poke();
    locker.appStateChanged('background');
    jest.advanceTimersByTime(10_000);
    expect(onLock).not.toHaveBeenCalled();
  });

  it('applies a new timeout to the running timer', () => {
    const { locker, onLock } = setup(300_000);
    locker.start();
    locker.setIdleMs(30_000);
    jest.advanceTimersByTime(30_000);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, NaN, Infinity])('rejects timeout %p', (ms) => {
    const { locker } = setup();
    expect(() => locker.setIdleMs(ms)).toThrow();
  });
});
