import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { clearCopiedSecret } from './clipboard';
import { DEFAULT_AUTO_LOCK_MS, IdleLocker } from './idleLocker';

export { AUTO_LOCK_OPTIONS, DEFAULT_AUTO_LOCK_MS } from './idleLocker';

export function useAutoLock(active: boolean, idleMs: number, lock: () => void): () => void {
  const lockRef = useRef(lock);
  useEffect(() => {
    lockRef.current = lock;
  }, [lock]);

  const locker = useMemo(
    () =>
      // The callback reads lockRef only when IdleLocker fires (timers / AppState), never during render.
      // eslint-disable-next-line react-hooks/refs
      new IdleLocker(DEFAULT_AUTO_LOCK_MS, () => {
        void clearCopiedSecret();
        lockRef.current();
      }),
    [],
  );

  useEffect(() => locker.setIdleMs(idleMs), [locker, idleMs]);

  useEffect(() => {
    if (active) locker.start();
    else locker.stop();
    return () => locker.stop();
  }, [active, locker]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => locker.appStateChanged(s));
    return () => sub.remove();
  }, [locker]);

  return useCallback(() => locker.poke(), [locker]);
}
