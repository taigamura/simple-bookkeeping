/**
 * Jest config for Kaji. Uses the `jest-expo` preset so RN/Expo modules run
 * under the same transform pipeline as the app. `transformIgnorePatterns`
 * whitelists the RN/Expo/vector-icons/font packages that ship untranspiled ESM
 * so Babel processes them instead of choking on `import`.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|@expo/vector-icons|react-native-safe-area-context|react-native-svg))',
  ],
};
