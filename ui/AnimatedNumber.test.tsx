/**
 * AnimatedNumber tests — the headline money figures that tick to their new
 * value instead of jumping.
 *
 * The property that actually matters here is not the animation: it is that the
 * *correct* figure is on screen at the first render and at the last frame. A
 * rolling total that starts at the right number and ends at the right number is
 * a nice transition; one that does either wrong is a bookkeeping app lying
 * about money. So the roll's endpoints are asserted directly, and the
 * intermediate frames only to the extent of proving they are intermediate.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { signed } from '../domain';
import { settleInitialRead } from '../test-utils/settleMotion';
import { MotionProvider, ThemeProvider } from '../theme';
import { AnimatedNumber } from './AnimatedNumber';

const format = (n: number) => signed(n, '¥');

/**
 * `Txt` reads the palette from ThemeProvider and throws without one, so both
 * providers wrap every case here — theme for color, motion for the roll.
 */
const tree = (value: number, animated: boolean, initialValue?: number) => (
  <ThemeProvider>
    <MotionProvider initialPreference={animated ? 'full' : 'reduced'}>
      <AnimatedNumber
        testID="figure"
        value={value}
        initialValue={initialValue}
        format={format}
        variant="summaryNet"
      />
    </MotionProvider>
  </ThemeProvider>
);

const renderNumber = (value: number, animated: boolean) => render(tree(value, animated));

// rAF is driven by hand so a "frame" is a deliberate step rather than a race
// against the test runner's clock.
let frameCallbacks: FrameRequestCallback[] = [];
let now = 0;

beforeEach(() => {
  frameCallbacks = [];
  now = 0;
  jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frameCallbacks.push(cb);
    return frameCallbacks.length;
  });
  jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Advance the roll by `ms`, flushing exactly one frame. */
const advance = (ms: number) => {
  now += ms;
  const pending = frameCallbacks;
  frameCallbacks = [];
  act(() => {
    pending.forEach((cb) => cb(now));
  });
};

const shown = () => screen.getByTestId('figure').props.children;

describe('AnimatedNumber', () => {
  it('renders the exact value on first paint, before any frame runs', async () => {
    renderNumber(-42300, true);
    await settleInitialRead();
    expect(shown()).toBe('−¥42,300');
  });

  it('can roll in from an explicit starting value', async () => {
    render(tree(100000, true, 0));
    await settleInitialRead();
    expect(shown()).toBe('+¥0');
    advance(0);
    advance(60);
    expect(shown()).not.toBe('+¥0');
    expect(shown()).not.toBe('+¥100,000');
  });

  it('lands precisely on the new value when the roll finishes', async () => {
    const view = renderNumber(-42300, true);
    await settleInitialRead();
    view.rerender(tree(-48900, true));

    // Well past `durations.slow` — the roll clamps at t=1 and stops.
    advance(0);
    advance(1000);
    expect(shown()).toBe('−¥48,900');
  });

  it('passes through intermediate values rather than cutting straight over', async () => {
    const view = renderNumber(0, true);
    await settleInitialRead();
    view.rerender(tree(100000, true));

    advance(0);
    advance(60);
    const mid = shown();
    expect(mid).not.toBe('+¥0');
    expect(mid).not.toBe('+¥100,000');
  });

  it('only ever shows whole currency units mid-roll', async () => {
    // Guards the per-frame Math.round: an unrounded intermediate would render
    // its full float expansion through toLocaleString ("+¥33,333.336").
    const view = renderNumber(0, true);
    await settleInitialRead();
    view.rerender(tree(100000, true));

    advance(0);
    advance(40);
    expect(shown()).not.toContain('.');
  });

  it('cuts straight to the value under reduced motion, scheduling no frames', async () => {
    const view = renderNumber(-42300, false);
    await settleInitialRead();
    view.rerender(tree(-48900, false));
    expect(shown()).toBe('−¥48,900');
    expect(frameCallbacks).toHaveLength(0);
  });

  it('renders un-animated outside a MotionProvider', () => {
    // The fallback that keeps the pre-existing component suite passing without
    // every test having to wrap in a provider.
    render(
      <ThemeProvider>
        <AnimatedNumber testID="figure" value={1200} format={format} variant="summaryNet" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('figure').props.children).toBe('+¥1,200');
    expect(frameCallbacks).toHaveLength(0);
  });
});
