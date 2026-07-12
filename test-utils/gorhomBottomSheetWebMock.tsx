/**
 * Jest double for `@gorhom/bottom-sheet` that keeps the official mock's
 * behavior but restores the library's REAL style handling on BottomSheetView,
 * which the official mock (`@gorhom/bottom-sheet/mock`) drops entirely — its
 * BottomSheetView is `props => props.children`, so style bugs can never
 * surface in tests that use it. That gap let a dev-web crash ship: passing a
 * 3-element style array to BottomSheetView crashed every sheet open on
 * `expo start --web` while the whole jest suite stayed green.
 *
 * Real behavior replicated here:
 * - BottomSheetView flattens an array `style` by SPREADING it into
 *   `StyleSheet.compose(...style)` — see
 *   node_modules/@gorhom/bottom-sheet/src/hooks/useBottomSheetContentContainerStyle.ts
 * - react-native-web's dev build throws when compose() gets more than two
 *   arguments — see react-native-web/dist/exports/StyleSheet/index.js.
 *   Native RN and production web have no guard: they silently DROP every
 *   style past the second element instead.
 *
 * So a style array longer than two elements is a crash on dev web and silent
 * style loss everywhere else. This double turns both failure modes into loud
 * jest failures: the >2 case throws the exact dev-web error, and the styles
 * that survive are actually applied to a real View so tests can assert them.
 *
 * Usage: jest.mock('@gorhom/bottom-sheet', () =>
 *   require('../test-utils/gorhomBottomSheetWebMock'));
 */
import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

const officialMock = jest.requireActual('@gorhom/bottom-sheet/mock');

function composeLikeGorhomOnDevWeb(style: ViewProps['style']): ViewProps['style'] {
  if (!style) {
    return {};
  }
  if (!Array.isArray(style)) {
    return style;
  }
  if (style.length > 2) {
    // Byte-for-byte the react-native-web dev error, so a regression here reads
    // identically to the crash a user would see on `expo start --web`.
    const readableStyles = style.map((s) => StyleSheet.flatten(s));
    throw new Error(
      `StyleSheet.compose() only accepts 2 arguments, received ${style.length}: ` +
        JSON.stringify(readableStyles),
    );
  }
  return StyleSheet.flatten(style);
}

function BottomSheetView({ children, style, ...rest }: ViewProps) {
  return (
    <View {...rest} style={composeLikeGorhomOnDevWeb(style)}>
      {children}
    </View>
  );
}

module.exports = { ...officialMock, BottomSheetView };
