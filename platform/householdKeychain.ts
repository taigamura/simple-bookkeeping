import * as SecureStore from 'expo-secure-store';
import type { KeychainSecretStore } from '../domain/pairing';

/** iOS stores these values as Generic Password items in the app Keychain. */
export const householdKeychain: KeychainSecretStore = {
  get(service, account) {
    return SecureStore.getItemAsync(account, { keychainService: service });
  },
  set(service, account, secret) {
    return SecureStore.setItemAsync(account, secret, {
      keychainService: service,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  delete(service, account) {
    return SecureStore.deleteItemAsync(account, { keychainService: service });
  },
};
