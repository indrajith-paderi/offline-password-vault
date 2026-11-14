import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { clearCopiedSecret } from './clipboard';
import { IdleLocker } from './idleLocker';

export const AUTO_LOCK_OPTIONS = [30_000, 60_000, 120_000, 300_000] as const;
export const DEFAULT_AUTO_LOCK_MS = 60_000;

export function useAutoLock(active: boolean, idleMs: number, lock: () => void): () => void {
  const lockRef = useRef(lock);
  lockRef.current = lock;

  const locker = useMemo(
    () =>
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
