/**
 * haptics — thin wrapper over expo-haptics (#26). No-ops on web (its own
 * `ImpactFeedbackStyle`/`NotificationFeedbackType` haptics aren't part of
 * this design) and swallows any native failure, so callers never need to
 * guard or await — a missed haptic is never worth erroring over, and under
 * jest the native module is absent (`requireOptionalNativeModule` resolves
 * to `null`, so every call throws `UnavailabilityError`) without needing a
 * mock in existing tests.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

async function fireAndForget(fn: () => Promise<void>): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await fn();
  } catch {
    // No-op: haptics are a nice-to-have, never critical-path.
  }
}

/** Light impact for each keypad tap. */
export function keypadTap(): void {
  void fireAndForget(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Success notification when an entry save lands. */
export function entrySaved(): void {
  void fireAndForget(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
