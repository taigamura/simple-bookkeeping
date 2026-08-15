/**
 * HeroPour tests — the Summary hero's fill-like-a-vessel entrance.
 *
 * The one property that matters for correctness is that the pour is purely
 * decorative: the children (the real figures) are always mounted and legible,
 * and the rising overlay only ever exists when motion is on and a measurement
 * has landed. So these assert the children's presence unconditionally and the
 * overlay's presence as a function of motion + layout — not the animation
 * itself, which the reanimated mock collapses to its end state.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { settleInitialRead } from '../test-utils/settleMotion';
import { MotionProvider, ThemeProvider } from '../theme';
import { HeroPour } from './HeroPour';

const tree = (trigger: string, preference: 'full' | 'reduced') => (
  <ThemeProvider>
    <MotionProvider initialPreference={preference}>
      <HeroPour trigger={trigger} radius={20} testID="pour">
        <Text testID="child">hero contents</Text>
      </HeroPour>
    </MotionProvider>
  </ThemeProvider>
);

/** RN Testing Library never fires layout on its own — drive it by hand. */
const layout = (height: number) =>
  act(() => {
    fireEvent(screen.getByTestId('pour-root'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height } },
    });
  });

describe('HeroPour', () => {
  it('always renders its children', async () => {
    render(tree('2026-08', 'full'));
    await settleInitialRead();
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('adds the rising overlay once a measurement lands, with motion on', async () => {
    render(tree('2026-08', 'full'));
    await settleInitialRead();
    // Before layout there is no height to pour through, so no overlay.
    expect(screen.queryByTestId('pour')).toBeNull();
    layout(200);
    expect(screen.getByTestId('pour')).toBeTruthy();
  });

  it('never adds the overlay under reduced motion, even after layout', async () => {
    render(tree('2026-08', 'reduced'));
    await settleInitialRead();
    layout(200);
    expect(screen.queryByTestId('pour')).toBeNull();
    // The figures are still fully present — the pour is decoration, not content.
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
