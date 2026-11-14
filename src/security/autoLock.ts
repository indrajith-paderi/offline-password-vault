import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { clearCopiedSecret } from './clipboard';

export const AUTO_LOCK_OPTIONS = [30_000, 60_000, 120_000, 300_000] as const;
export const DEFAULT_AUTO_LOCK_MS = 60_000;

export function useAutoLock(active: boolean, idleMs: number, lock: () => void): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLock = useCallback(() => {
    void clearCopiedSecret();
    lock();
  }, [lock]);

  const poke = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (active) timer.current = setTimeout(doLock, idleMs);
  }, [active, idleMs, doLock]);

  useEffect(() => {
    poke();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poke]);

  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') doLock();
    });
    return () => sub.remove();
  }, [active, doLock]);

  return poke;
}
