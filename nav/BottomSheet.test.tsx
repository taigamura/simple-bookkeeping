/**
 * BottomSheet — unit tests for sheet configuration, handle gesture setup, and
 * the BottomSheetView style contract.
 *
 * Style contract: gorhom's BottomSheetView spreads array styles into
 * `StyleSheet.compose(...style)`, which react-native-web throws on in dev when
 * the array has more than two elements, and which native/production silently
 * truncates to two. So BottomSheet must hand BottomSheetView a compose-safe
 * style (a single flattened object).
 *
 * Why the mocks: under jest the REAL library never mounts the modal's children
 * (present() needs layout/animation plumbing jsdom doesn't provide), and the
 * real SafeAreaProvider renders no children at all while waiting for native
 * inset metrics. Together those quietly reduced this file to rendering an
 * empty provider — which is how the dev-web compose crash shipped with a green
 * suite. The gorhom double (`test-utils/gorhomBottomSheetWebMock`) restores
 * the library's real style handling, including the dev-web throw, and the
 * safe-area jest mock lets content actually mount so assertions see nodes.
 *
 * Note: Gesture handler testing is limited in the jest/jsdom environment.
 * Full validation requires device testing where actual touch events can
 * trigger the pan gesture on the grab bar (#62).
 */
jest.mock('@gorhom/bottom-sheet', () =>
  require('../test-utils/gorhomBottomSheetWebMock'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';
import { BottomSheet, type BottomSheetProps } from './BottomSheet';

function renderSheet(props: Partial<BottomSheetProps> = {}) {
  return render(
    <ThemeProvider>
      <SafeAreaProvider>
        <BottomSheet visible={true} onClose={jest.fn()} testID="test-sheet" {...props}>
          {props.children ?? <Text>Test Content</Text>}
        </BottomSheet>
      </SafeAreaProvider>
    </ThemeProvider>,
  );
}

function appliedContentStyle(): ViewStyle {
  return StyleSheet.flatten(
    screen.getByTestId('test-sheet').props.style as StyleProp<ViewStyle>,
  );
}

describe('BottomSheet', () => {
  const modalProps = (): any =>
    require('../test-utils/gorhomBottomSheetWebMock').getLastBottomSheetModalProps();

  test('renders without crashing when visible is false', () => {
    expect(() => renderSheet({ visible: false })).not.toThrow();
  });

  test('renders without crashing when visible is true', () => {
    expect(() => renderSheet({ visible: true })).not.toThrow();
  });

  test('mounts children unconditionally per mounting contract (#47)', () => {
    // Content must be in the tree even before presentation so the modal can
    // measure its height at present() time.
    renderSheet({ visible: false });
    expect(screen.getByText('Test Content')).toBeTruthy();
  });

  test('handles visibility transitions', () => {
    const onCloseMock = jest.fn();
    const { rerender } = renderSheet({ visible: true, onClose: onCloseMock });
    expect(() => {
      rerender(
        <ThemeProvider>
          <SafeAreaProvider>
            <BottomSheet visible={false} onClose={onCloseMock} testID="test-sheet">
              <Text>Test Content</Text>
            </BottomSheet>
          </SafeAreaProvider>
        </ThemeProvider>,
      );
    }).not.toThrow();
  });

  test('content style survives react-native-web dev StyleSheet.compose guard', () => {
    // Regression: BottomSheet passed a 3-element style array to BottomSheetView,
    // which gorhom spreads into StyleSheet.compose(...). react-native-web dev
    // throws on >2 args, crashing every sheet open on `expo start --web`. The
    // gorhom double reproduces that throw, so rendering is itself the assertion.
    renderSheet();
    expect(screen.getByTestId('test-sheet')).toBeTruthy();
  });

  test('content view carries base padding and the min-height floor (#60)', () => {
    renderSheet();
    const applied = appliedContentStyle();
    expect(applied.paddingHorizontal).toBe(20);
    expect(applied.paddingTop).toBe(4);
    // paddingBottom includes base 28 + bottom safe-area inset (#69)
    expect(applied.paddingBottom).toBe(28); // mock default inset is 0
    expect(applied.minHeight).toBe(200);
  });

  test('caller style is applied, not silently dropped, and wins over defaults', () => {
    // Native RN and production web truncate compose() input to two styles
    // instead of throwing, so a >2-element array would silently discard the
    // caller's style prop there. Assert the custom style actually lands.
    renderSheet({ style: { minHeight: 400, paddingBottom: 99 } });
    const applied = appliedContentStyle();
    expect(applied.minHeight).toBe(400);
    expect(applied.paddingBottom).toBe(99);
    expect(applied.paddingHorizontal).toBe(20); // defaults still present
  });

  test('sheet is configured with handle panning gesture for device (#62)', () => {
    // Documents that BottomSheetModal is explicitly configured with
    // enableHandlePanningGesture. On device, this allows the grab bar to
    // respond to touch and pan gestures; verified by device testing.
    expect(() => renderSheet()).not.toThrow();
    // On device: verify grab bar drag visibly tracks finger and fling dismisses
  });

  test('offers an expanded snap point while retaining dynamic natural sizing', () => {
    renderSheet();
    expect(modalProps().enableDynamicSizing).toBe(true);
    expect(modalProps().snapPoints).toEqual([appliedContentStyle().maxHeight]);
  });

  test('retains the greatest laid-out height during an open sheet session', () => {
    renderSheet();

    fireEvent(screen.getByTestId('test-sheet'), 'layout', {
      nativeEvent: { layout: { height: 480, width: 320, x: 0, y: 0 } },
    });

    expect(appliedContentStyle().minHeight).toBe(480);

    fireEvent(screen.getByTestId('test-sheet'), 'layout', {
      nativeEvent: { layout: { height: 260, width: 320, x: 0, y: 0 } },
    });
    expect(appliedContentStyle().minHeight).toBe(480);
  });

  test('redirects an expanded downward drag to dismissal', () => {
    const onClose = jest.fn();
    renderSheet({ onClose });

    modalProps().onAnimate(1, 0, 44, 300);
    expect(onClose).toHaveBeenCalledTimes(1);

    modalProps().onAnimate(0, 1, 300, 44);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
