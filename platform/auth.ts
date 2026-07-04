/**
 * auth — thin wrapper over expo-local-authentication (#30). The app root
 * imports only this module (never expo-local-authentication directly) so
 * tests and web can fake the whole seam without touching the native module,
 * which isn't mockable the way a proper expo-modules-test-core package is
 * (no generated `mocks/` fixture ships with this one).
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** Whether the device can gate the app at all (biometrics or a passcode enrolled). */
export async function isAuthAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

/** Prompt biometrics, falling back to the device passcode. Always true on web. */
export async function authenticate(promptMessage: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
  });
  return result.success;
}
