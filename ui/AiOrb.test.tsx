/**
 * AiOrb's web/Jest stand-in (PRD #145): the same props as the Skia orb, with
 * the state visible to tests (accessibilityValue, ring, accent points) and the
 * press wiring the voice flow relies on.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemeProvider } from '../theme';
import { AiOrb, LONG_PRESS_MS, fibonacciSphere, projectOrb, type OrbState } from './AiOrb';

function renderOrb(state: OrbState, extra: Partial<React.ComponentProps<typeof AiOrb>> = {}) {
  return render(
    <ThemeProvider>
      <AiOrb testID="orb" size={60} state={state} level={0.8} accessibilityLabel="Suito AI" {...extra} />
    </ThemeProvider>,
  );
}

describe('AiOrb stand-in', () => {
  it.each<OrbState>(['idle', 'listen', 'think'])('publishes the %s state', (state) => {
    renderOrb(state);
    const orb = screen.getByTestId('orb');
    expect(orb.props.accessibilityValue).toEqual({ text: state });
    expect(orb.props.accessibilityState).toEqual(expect.objectContaining({ busy: state === 'think' }));
  });

  it('is a labelled button with the 250 ms hold delay', () => {
    renderOrb('idle', { accessibilityHint: 'Tap to ask' });
    const orb = screen.getByRole('button', { name: 'Suito AI' });
    expect(orb.props.accessibilityHint).toBe('Tap to ask');
    expect(LONG_PRESS_MS).toBe(250);
  });

  it('takes an accent ring while listening and a second ring while thinking', () => {
    renderOrb('idle');
    const idleDisc = StyleSheet.flatten(screen.getByTestId('orb-disc').props.style);
    expect(idleDisc.borderWidth).toBeLessThan(2);
    expect(screen.queryByTestId('orb-ring')).toBeNull();

    screen.rerender(
      <ThemeProvider>
        <AiOrb testID="orb" size={60} state="listen" level={0.8} />
      </ThemeProvider>,
    );
    expect(StyleSheet.flatten(screen.getByTestId('orb-disc').props.style).borderWidth).toBe(2);
    expect(screen.queryByTestId('orb-ring')).toBeNull();

    screen.rerender(
      <ThemeProvider>
        <AiOrb testID="orb" size={60} state="think" level={0} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('orb-ring')).toBeTruthy();
  });

  it('routes tap, hold and release to their handlers', () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    const onPressOut = jest.fn();
    renderOrb('idle', { onPress, onLongPress, onPressOut });
    const orb = screen.getByTestId('orb');
    fireEvent.press(orb);
    fireEvent(orb, 'longPress');
    fireEvent(orb, 'pressOut');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});

describe('projectOrb', () => {
  const seeds = fibonacciSphere(72);
  const base = { t: 0, rec: 0, think: 0, level: 0, size: 60 };
  const spread = (f: ReturnType<typeof projectOrb>) =>
    Math.max(...[...f.buckets.flat(), ...f.accent].map((p) => Math.hypot(p.x - 30, p.y - 30)));

  it('idle: every point inside the disc, no accent points', () => {
    const f = projectOrb(seeds, base);
    expect(f.accent).toHaveLength(0);
    expect(f.buckets.flat()).toHaveLength(72);
    expect(spread(f)).toBeLessThan(60 * 0.43);
  });

  it('listening: the level scatters points outward and some glow', () => {
    const quiet = projectOrb(seeds, { ...base, rec: 1, level: 0 });
    const loud = projectOrb(seeds, { ...base, rec: 1, level: 1 });
    expect(loud.accent.length).toBeGreaterThan(0);
    expect(spread(loud)).toBeGreaterThan(spread(quiet));
  });

  it('thinking: points gather onto five rings', () => {
    const f = projectOrb(seeds, { ...base, think: 1 });
    const ys = new Set([...f.buckets.flat(), ...f.accent].map((p) => Math.round(p.y)));
    expect(f.accent.length).toBeGreaterThan(0);
    expect(ys.size).toBeLessThan(40);
  });
});
