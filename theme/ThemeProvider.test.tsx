/**
 * ThemeProvider tests — the system/light/dark preference introduced when Kaji
 * stopped being manual-only. The distinction that matters: `preference` is what
 * the user chose and what Settings highlights, `mode` is what actually renders.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from './ThemeProvider';
import { palettes, type ThemePreference } from './tokens';

// Controlled per test so we can flip the "OS" underneath the provider.
let mockSystemScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockSystemScheme,
}));

function Probe() {
  const { mode, preference, colors, setPreference, toggle } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="preference">{preference}</Text>
      <Text testID="bg">{colors.bg}</Text>
      <Text testID="toggle" onPress={toggle}>
        toggle
      </Text>
      <Text testID="pick-system" onPress={() => setPreference('system')}>
        system
      </Text>
      <Text testID="pick-dark" onPress={() => setPreference('dark')}>
        dark
      </Text>
    </>
  );
}

const renderTheme = (
  initialPreference?: ThemePreference,
  onPreferenceChange?: (p: ThemePreference) => void,
) =>
  render(
    <ThemeProvider initialPreference={initialPreference} onPreferenceChange={onPreferenceChange}>
      <Probe />
    </ThemeProvider>,
  );

const text = (id: string) => screen.getByTestId(id).props.children;

beforeEach(() => {
  mockSystemScheme = 'light';
});

describe('ThemeProvider', () => {
  it('defaults to following the system', () => {
    renderTheme();
    expect(text('preference')).toBe('system');
    expect(text('mode')).toBe('light');
  });

  it('resolves `system` to dark when the OS is dark', () => {
    mockSystemScheme = 'dark';
    renderTheme('system');
    expect(text('preference')).toBe('system');
    expect(text('mode')).toBe('dark');
    expect(text('bg')).toBe(palettes.dark.bg);
  });

  it('falls back to light when the platform reports no scheme', () => {
    mockSystemScheme = null;
    renderTheme('system');
    expect(text('mode')).toBe('light');
    expect(text('bg')).toBe(palettes.light.bg);
  });

  it('ignores the OS once a mode is pinned', () => {
    mockSystemScheme = 'dark';
    renderTheme('light');
    expect(text('mode')).toBe('light');
    expect(text('bg')).toBe(palettes.light.bg);
  });

  it('keeps `system` as the reported preference even though mode resolves', () => {
    mockSystemScheme = 'dark';
    renderTheme('system');
    // Settings highlights `system`, not the dark it currently resolves to.
    expect(text('preference')).toBe('system');
  });

  it('reports preference changes so the caller can persist them', () => {
    const onPreferenceChange = jest.fn();
    renderTheme('system', onPreferenceChange);
    fireEvent.press(screen.getByTestId('pick-dark'));
    expect(onPreferenceChange).toHaveBeenCalledWith('dark');
    expect(text('mode')).toBe('dark');
  });

  it('does not report a change when the preference is re-selected', () => {
    const onPreferenceChange = jest.fn();
    renderTheme('dark', onPreferenceChange);
    fireEvent.press(screen.getByTestId('pick-dark'));
    expect(onPreferenceChange).not.toHaveBeenCalled();
  });

  it('toggle pins the opposite of whatever the system is currently giving', () => {
    mockSystemScheme = 'dark';
    renderTheme('system');
    fireEvent.press(screen.getByTestId('toggle'));
    expect(text('preference')).toBe('light');
    expect(text('mode')).toBe('light');
  });

  it('can return to following the system after pinning', () => {
    mockSystemScheme = 'dark';
    renderTheme('light');
    expect(text('mode')).toBe('light');
    fireEvent.press(screen.getByTestId('pick-system'));
    expect(text('preference')).toBe('system');
    expect(text('mode')).toBe('dark');
  });
});
