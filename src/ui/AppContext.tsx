import { createContext, useContext } from 'react';
import type { Settings, Vault } from '../vault/vault';

export type Route =
  | { name: 'list' }
  | { name: 'entry'; id: string }
  | { name: 'edit'; id?: string }
  | { name: 'settings' }
  | { name: 'export' }
  | { name: 'restore' }
  | { name: 'changePin' }
  | { name: 'licenses' }
  | { name: 'about' };

export type AppCtx = {
  vault: Vault;
  settings: Settings;
  setSettings: (s: Settings) => void;
  go: (r: Route) => void;
  back: () => void;
  warnings: string[];
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(AppContext);
  if (!c) throw new Error('AppContext missing');
  return c;
}

export const nextFrame = () => new Promise<void>((r) => setTimeout(r, 50));

export function formatDuration(ms: number): string {
  const m = Math.ceil(ms / 60000);
  return m >= 60 ? '1 hour' : `${m} minute${m === 1 ? '' : 's'}`;
}
