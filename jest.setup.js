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

// `@expo/vector-icons` builds its icon components with `createIconSet`, which
// loads the glyph font in an async effect and then `setState`s. Under jest that
// resolves after the test body has returned, so every render of an icon emits an
// "update was not wrapped in act(...)" warning — noise that buries real warnings
// (#73). Feather is the only set the app uses; swap it for a synchronous stub
// that forwards props (testID, accessibilityLabel) so queries still resolve.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const React = require('react');
  const Feather = ({ name, ...props }) => React.createElement(Text, props, name);
  return { Feather };
});
