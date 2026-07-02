/**
 * Global test setup. Swaps AsyncStorage for its official in-memory mock, so the
 * default store path (which talks to real AsyncStorage) is exercisable in a Node
 * test environment. `@testing-library/react-native` v13 auto-registers its jest
 * matchers, so no explicit extend-expect import is needed.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
