import * as Haptics from 'expo-haptics';

/**
 * Thin, fire-and-forget wrapper so a missing vibrator (or a disabled system setting)
 * can never throw into UI code. Haptics are local device APIs: no permission prompt,
 * no network.
 */
const safe = (p: Promise<void>) => void p.catch(() => undefined);

export const haptic = {
  tick: () => safe(Haptics.selectionAsync()),
  light: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
