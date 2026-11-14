import SecureNative from '../../modules/secure-native';

export const CLIPBOARD_CLEAR_MS = 30_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let armed = false;

/**
 * Copy marked as sensitive (hidden from Android's clipboard preview, kept off Universal
 * Clipboard on iOS), then cleared after 30 seconds or when the vault locks, whichever first.
 */
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
    // Some OEM builds throw if the clipboard changed owner; nothing more we can do.
  }
}
