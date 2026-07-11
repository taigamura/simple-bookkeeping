/**
 * Jest config for Kaji. Uses the `jest-expo` preset so RN/Expo modules run
 * under the same transform pipeline as the app. `transformIgnorePatterns`
 * whitelists the RN/Expo/vector-icons/font packages that ship untranspiled ESM
 * so Babel processes them instead of choking on `import`.
 */
module.exports = {
  preset: 'jest-expo',
  // Reanimated v4 pulls in react-native-worklets, whose `.native` entry throws
  // when required under jest. This resolver (shipped by the package) strips the
  // `.native` extension for worklets modules so its JS variant loads instead,
  // letting the animation stack (MonthPager, #45) import cleanly in tests.
  resolver: 'react-native-worklets/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // The Playwright suite (#58) uses jest's default `.spec.ts` naming — keep
  // jest out of it (and out of exported web builds).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|@expo/vector-icons|react-native-safe-area-context|react-native-svg))',
  ],
};
