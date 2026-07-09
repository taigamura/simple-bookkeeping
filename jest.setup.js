/**
 * Global test setup. Swaps AsyncStorage for its official in-memory mock, so the
 * default store path (which talks to real AsyncStorage) is exercisable in a Node
 * test environment. `@testing-library/react-native` v13 auto-registers its jest
 * matchers, so no explicit extend-expect import is needed.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Gesture Handler + Reanimated jest support (#45). RNGH ships a setup that stubs
// its native module; Reanimated v4 can't load its native worklets bridge under
// jest (it throws at import), so swap in its official JS mock. This lets the
// MonthPager — and anything else importing the animation stack — load in tests.
require('react-native-gesture-handler/jestSetup');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
