import SecureNative from '../../modules/secure-native';

export const CLIPBOARD_CLEAR_MS = 30_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let armed = false;

export async function copySecret(text: string, clearAfterMs = CLIPBOARD_CLEAR_MS): Promise<void> {
  await SecureNative.copySensitive(text, clearAfterMs);
  armed = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void clearCopiedSecret(), clearAfterMs);
}

export async function clearCopiedSecret(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!armed) return;
  armed = false;
  try {
    await SecureNative.clearClipboard();
  } catch {
  }
}
