/**
 * Tab-swap transition test. The defect this covers is not "the animation has
 * the wrong duration" — that is a taste call verified on device — but the
 * structural one underneath it: the app used to mount *only* the active screen,
 * so on a tab press the outgoing screen was gone on the first frame and the
 * incoming one animated in over an empty background. An entrance with no
 * matching exit reads as a cut, and no amount of retuning the entrance fixes
 * that. So what is asserted here is the overlap: both screens are mounted for
 * the length of the swap, and the outgoing one is then dropped rather than
 * leaking.
 *
 * `MotionProvider initialPreference="full"` is required: `useMotion()` with no
 * provider reports `enabled: false`, and the motion-off path deliberately keeps
 * the old single-mount behaviour (there is nothing to animate out, so holding a
 * second screen live would be pure cost).
 */
jest.mock('@gorhom/bottom-sheet', () =>
  require('../test-utils/gorhomBottomSheetWebMock'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../platform/haptics', () => ({ entrySaved: jest.fn(), keypadTap: jest.fn() }));
jest.mock('../platform/shareFile', () => ({ shareTextFile: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {} }));

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { strings } from '../i18n';
import { DEFAULT_STATE } from '../store/schema';
import { MotionProvider, ThemeProvider } from '../theme';
import { Root } from './Root';

// Comfortably past TAB_TRANSITION_DURATION (320ms) in Root.tsx.
const PAST_SWAP = 500;

// Async so the `AccessibilityInfo.isReduceMotionEnabled()` read inside
// MotionProvider can settle inside `act`. It does not change `enabled` for
// either preference used here (only `system` depends on it), but leaving the
// promise in flight makes every test log an act() warning.
async function renderRoot(motion: 'full' | 'reduced') {
  const utils = render(
    <ThemeProvider>
      <MotionProvider initialPreference={motion}>
        <Root
          state={DEFAULT_STATE}
          update={() => {}}
          showCorruptNotice={false}
          hasCorruptStash={false}
          readCorruptStash={async () => null}
        />
      </MotionProvider>
    </ThemeProvider>,
  );
  await act(async () => {});
  return utils;
}

// Both screens page their body content, and those pagers are the cheapest
// unambiguous marker for "this screen is mounted" — the tab bar itself always
// shows both tab *labels*, so matching on text would prove nothing.
const calendarMounted = () => screen.queryAllByTestId('month-pager').length > 0;
const summaryMounted = () => screen.queryAllByTestId('summary-pager').length > 0;

describe('tab swap', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('starts on Calendar with Summary not mounted', async () => {
    await renderRoot('full');
    expect(calendarMounted()).toBe(true);
    expect(summaryMounted()).toBe(false);
  });

  it('holds both screens mounted during the swap, then drops the outgoing one', async () => {
    await renderRoot('full');

    fireEvent.press(screen.getByLabelText(strings.nav.summary));
    // The overlap: the screen being left is still there to animate out.
    expect(summaryMounted()).toBe(true);
    expect(calendarMounted()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(PAST_SWAP);
    });
    expect(summaryMounted()).toBe(true);
    expect(calendarMounted()).toBe(false);
  });

  it('overlaps in the other direction too', async () => {
    await renderRoot('full');
    fireEvent.press(screen.getByLabelText(strings.nav.summary));
    act(() => {
      jest.advanceTimersByTime(PAST_SWAP);
    });

    fireEvent.press(screen.getByLabelText(strings.nav.calendar));
    expect(calendarMounted()).toBe(true);
    expect(summaryMounted()).toBe(true);

    act(() => {
      jest.advanceTimersByTime(PAST_SWAP);
    });
    expect(calendarMounted()).toBe(true);
    expect(summaryMounted()).toBe(false);
  });

  it('does not leak a third layer when the tabs are swapped back mid-transition', async () => {
    await renderRoot('full');
    fireEvent.press(screen.getByLabelText(strings.nav.summary));
    // Reverse before the first swap has finished: the layer that was exiting
    // becomes the entering one again rather than a new instance stacking up.
    fireEvent.press(screen.getByLabelText(strings.nav.calendar));
    expect(screen.queryAllByTestId('month-pager')).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(PAST_SWAP);
    });
    expect(calendarMounted()).toBe(true);
    expect(summaryMounted()).toBe(false);
  });

  it('mounts only the incoming screen when motion is off', async () => {
    await renderRoot('reduced');
    fireEvent.press(screen.getByLabelText(strings.nav.summary));
    expect(summaryMounted()).toBe(true);
    expect(calendarMounted()).toBe(false);
  });
});
