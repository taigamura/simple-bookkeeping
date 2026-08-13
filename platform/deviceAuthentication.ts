import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { DeviceAuthenticator } from '../domain';

const ACCOUNT = 'kaji.recovery.device-authentication';

/**
 * A Keychain item protected by the device passcode/biometrics is used as a
 * harmless challenge. Reading it asks iOS to authenticate without ever putting
 * the recovery passphrase in storage.
 */
export const deviceAuthenticator: DeviceAuthenticator = {
  async authenticate(reason) {
    if (Platform.OS === 'web') return false;
    const prompt = reason === 'export-recovery' ? 'Authenticate to export your recovery pack' : 'Authenticate to restore your recovery pack';
    try {
      let challenge = await SecureStore.getItemAsync(ACCOUNT, { authenticationPrompt: prompt });
      if (!challenge) {
        challenge = 'recovery-authentication-challenge';
        await SecureStore.setItemAsync(ACCOUNT, challenge, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          requireAuthentication: true,
          authenticationPrompt: prompt,
        });
        challenge = await SecureStore.getItemAsync(ACCOUNT, { authenticationPrompt: prompt });
      }
      return challenge === 'recovery-authentication-challenge';
    } catch { return false; }
  },
};
