import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

/**
 * Light / Dark / System appearance choice. Kept outside the vault so the lock screen
 * can use it before unlock; it is a display preference, not a secret.
 */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'ui_theme';
let current: ThemePref = 'system';

function apply(p: ThemePref) {
  Appearance.setColorScheme(p === 'system' ? 'unspecified' : p);
}

export async function loadThemePref(): Promise<void> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v === 'light' || v === 'dark') current = v;
  } catch {
    current = 'system';
  }
  apply(current);
}

export function getThemePref(): ThemePref {
  return current;
}

export async function setThemePref(p: ThemePref): Promise<void> {
  current = p;
  apply(p);
  try {
    await SecureStore.setItemAsync(KEY, p);
  } catch {
    // Display preference only; failing to persist is harmless.
  }
}
