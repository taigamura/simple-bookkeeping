/**
 * BottomSheet dismiss-lifecycle regression tests (#63 / desktop empty-sheet bug).
 *
 * The bug: gorhom fires `onDismiss` from a render captured *before* the ✕ tap
 * updated nav state, so the old reconciliation handler read a stale `visible=true`
 * and re-presented the modal — right as the effect was dismissing it. That popped
 * an empty sheet (content had already unmounted) which the user had to close a
 * second time, and wedged the modal so the next open silently failed.
 *
 * These tests drive that exact lifecycle: they trigger the modal's `onDismiss`
 * and assert the sheet (1) tells nav to close, (2) does NOT re-present, and
 * (3) can be reopened afterwards. The gorhom mock here is bespoke: the official
 * `@gorhom/bottom-sheet/mock` never fires `onDismiss`, so it cannot express this
 * bug at all. We expose a "trigger-dismiss" control and spy `present`/`dismiss`.
 */
const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactLocal = require('react');
  const { Pressable, Text } = require('react-native');
  const official = jest.requireActual('@gorhom/bottom-sheet/mock');

  class BottomSheetModal extends ReactLocal.Component {
    present(...args: unknown[]) {
      mockPresent(...args);
    }
    dismiss(...args: unknown[]) {
      mockDismiss(...args);
    }
    render() {
      const { children, onDismiss } = this.props;
      const content = typeof children === 'function' ? children({}) : children;
      // "trigger-dismiss" stands in for gorhom finishing a dismiss animation
      // (✕/backdrop/pan-down) and calling the onDismiss prop.
      return ReactLocal.createElement(
        ReactLocal.Fragment,
        null,
        ReactLocal.createElement(
          Pressable,
          { testID: 'trigger-dismiss', onPress: onDismiss },
          ReactLocal.createElement(Text, null, 'trigger'),
        ),
        content,
      );
    }
  }

  return { ...official, BottomSheetModal };
});
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import { fireEvent, render, screen } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';
import { BottomSheet } from './BottomSheet';

/**
 * Controlled harness mirroring Root's ownership: `onClose` flips `visible`,
 * exactly like `closeSheet = () => setSheet(null)` does in nav.
 */
function Harness({ onCloseSpy }: { onCloseSpy: () => void }) {
  const [visible, setVisible] = useState(true);
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <BottomSheet
          visible={visible}
          onClose={() => {
            onCloseSpy();
            setVisible(false);
          }}
          testID="sheet"
        >
          <Text>Sheet body</Text>
        </BottomSheet>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
});

test('a gorhom dismiss closes nav and does NOT re-present (no empty sheet)', () => {
  const onCloseSpy = jest.fn();
  render(<Harness onCloseSpy={onCloseSpy} />);

  // Mount presents exactly once.
  expect(mockPresent).toHaveBeenCalledTimes(1);
  mockPresent.mockClear();

  // gorhom finishes a dismiss and fires onDismiss.
  fireEvent.press(screen.getByTestId('trigger-dismiss'));

  // Nav is told to close…
  expect(onCloseSpy).toHaveBeenCalledTimes(1);
  // …and the modal is NOT re-presented. Pre-fix this fired again (the empty
  // sheet the user had to close a second time).
  expect(mockPresent).not.toHaveBeenCalled();
});

test('the sheet reopens after a dismiss (modal is not left wedged)', () => {
  function ReopenHarness() {
    const [visible, setVisible] = useState(true);
    return (
      <ThemeProvider>
        <SafeAreaProvider>
          <BottomSheet visible={visible} onClose={() => setVisible(false)} testID="sheet">
            <Text>Sheet body</Text>
          </BottomSheet>
          <Text onPress={() => setVisible(true)} testID="reopen">
            reopen
          </Text>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }
  render(<ReopenHarness />);
  expect(mockPresent).toHaveBeenCalledTimes(1); // initial open

  // gorhom dismisses (fires onDismiss). The handler marks not-presented itself,
  // so the effect does not re-issue dismiss() — the modal already closed.
  fireEvent.press(screen.getByTestId('trigger-dismiss'));
  mockPresent.mockClear();

  // Reopen must present again. Pre-fix the modal was left wedged and this
  // present() never took effect (the sheet silently failed to reopen).
  fireEvent.press(screen.getByTestId('reopen'));
  expect(mockPresent).toHaveBeenCalledTimes(1);
});
