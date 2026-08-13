jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { householdKeychain } from './householdKeychain';

describe('native household Keychain adapter', () => {
  it('uses the service namespace and device-only unlocked accessibility', async () => {
    await householdKeychain.set('kaji.household', 'household.h1', 'secret');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('household.h1', 'secret', {
      keychainService: 'kaji.household',
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    await householdKeychain.get('kaji.household', 'household.h1');
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('household.h1', { keychainService: 'kaji.household' });

    await householdKeychain.delete('kaji.household', 'household.h1');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('household.h1', { keychainService: 'kaji.household' });
  });
});
