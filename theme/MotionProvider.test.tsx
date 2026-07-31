/**
 * MotionProvider tests — the system/full/reduced preference that decides
 * whether the app animates at all.
 *
 * The distinction that matters mirrors ThemeProvider's: `preference` is what
 * the user chose and what Settings highlights, `enabled` is the resolved answer
 * components branch on. The three-way shape exists precisely so that "the OS
 * says reduce motion" and "this user turned Kaji's motion off" stay separable,
 * so most of what is worth asserting here is that one does not silently stand
 * in for the other.
 */
import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, render, screen, fireEvent } from '@testing-library/react-native';

import { MotionProvider, useMotion } from './MotionProvider';
import type { MotionPreference } from './motion';

// Controlled per test so we can flip the "OS" reduce-motion flag underneath the
// provider, both at mount (the async initial read) and live (the event).
let mockReduceMotion = false;
let emitReduceMotion: ((value: boolean) => void) | null = null;

jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
  () => Promise.resolve(mockReduceMotion),
);
jest
  .spyOn(AccessibilityInfo, 'addEventListener')
  .mockImplementation((event: string, handler: unknown) => {
    if (event === 'reduceMotionChanged') {
      emitReduceMotion = handler as (value: boolean) => void;
    }
    return { remove: () => {} } as never;
  });

function Probe() {
  const { enabled, preference, systemReducedMotion, setPreference } = useMotion();
  return (
    <>
      <Text testID="enabled">{String(enabled)}</Text>
      <Text testID="preference">{preference}</Text>
      <Text testID="system">{String(systemReducedMotion)}</Text>
      <Text testID="pick-system" onPress={() => setPreference('system')}>
        system
      </Text>
      <Text testID="pick-full" onPress={() => setPreference('full')}>
        full
      </Text>
      <Text testID="pick-reduced" onPress={() => setPreference('reduced')}>
        reduced
      </Text>
    </>
  );
}

const renderMotion = (
  initialPreference?: MotionPreference,
  onPreferenceChange?: (p: MotionPreference) => void,
) =>
  render(
    <MotionProvider
      initialPreference={initialPreference}
      onPreferenceChange={onPreferenceChange}
    >
      <Probe />
    </MotionProvider>,
  );

const text = (id: string) => screen.getByTestId(id).props.children;

/** Let the provider's async initial read of the OS flag resolve. */
const settleInitialRead = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockReduceMotion = false;
  emitReduceMotion = null;
});

describe('MotionProvider', () => {
  it('defaults to following the system, and animates when it is quiet', async () => {
    renderMotion();
    await settleInitialRead();
    expect(text('preference')).toBe('system');
    expect(text('enabled')).toBe('true');
  });

  it('stops animating when the OS asks for reduced motion', async () => {
    mockReduceMotion = true;
    renderMotion();
    await settleInitialRead();
    expect(text('system')).toBe('true');
    expect(text('enabled')).toBe('false');
  });

  it('animates on the first frame rather than suppressing until the read lands', () => {
    // Deliberate: starting "reduced" would cost every user the opening frame of
    // every launch animation to spare it for the few with the setting on.
    mockReduceMotion = true;
    renderMotion();
    expect(text('enabled')).toBe('true');
  });

  it('re-resolves live when the OS flag flips', async () => {
    renderMotion();
    await settleInitialRead();
    expect(text('enabled')).toBe('true');

    act(() => emitReduceMotion?.(true));
    expect(text('enabled')).toBe('false');
  });

  it('lets `full` override an OS that asked for reduced motion', async () => {
    mockReduceMotion = true;
    renderMotion('full');
    await settleInitialRead();
    // The OS flag is still reported truthfully — the preference just wins.
    expect(text('system')).toBe('true');
    expect(text('enabled')).toBe('true');
  });

  it('lets `reduced` override an OS that did not ask for it', async () => {
    renderMotion('reduced');
    await settleInitialRead();
    expect(text('system')).toBe('false');
    expect(text('enabled')).toBe('false');
  });

  it('reports preference changes so the caller can persist them', async () => {
    const onChange = jest.fn();
    renderMotion('system', onChange);
    await settleInitialRead();

    fireEvent.press(screen.getByTestId('pick-reduced'));
    expect(onChange).toHaveBeenCalledWith('reduced');
    expect(text('preference')).toBe('reduced');

    // Re-picking the same value is not a change and must not churn storage.
    fireEvent.press(screen.getByTestId('pick-reduced'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('falls back to not animating outside a provider, rather than throwing', () => {
    // Motion is an enhancement: a component rendered in a test harness or a
    // throwaway prototype should render un-animated, not crash. (This is the
    // reason the whole existing component suite still passes untouched.)
    render(<Probe />);
    expect(text('enabled')).toBe('false');
    expect(text('preference')).toBe('system');
  });
});
