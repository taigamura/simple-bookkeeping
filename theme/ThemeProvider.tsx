/**
 * ThemeProvider — supplies the active color palette and appearance switching.
 *
 * Supersedes build-decision 9 (manual only). The user picks a *preference* —
 * `system`, `light` or `dark` — and `system` resolves against the OS via
 * `useColorScheme`, re-resolving live when the device flips. `mode` is always
 * the concrete appearance being rendered; `preference` is what Settings shows
 * as selected.
 *
 * The provider stays storage-agnostic: it accepts an `initialPreference`
 * (seeded from persisted state) and reports changes via `onPreferenceChange`.
 * `App` plugs the store into those two props, so the choice persists across
 * reload without this component knowing about AsyncStorage.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  colorsFor,
  type Colors,
  type ThemeMode,
  type ThemePreference,
} from './tokens';

interface ThemeContextValue {
  /** The appearance actually rendered — `system` already resolved. */
  mode: ThemeMode;
  /** What the user selected; `system` stays `system` here. */
  preference: ThemePreference;
  colors: Colors;
  setPreference: (preference: ThemePreference) => void;
  /**
   * Flip between light and dark, pinning the result. From `system` this pins
   * the opposite of whatever the OS is currently giving us.
   */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Starting preference (e.g. restored from storage). Defaults to `system`. */
  initialPreference?: ThemePreference;
  /** Called whenever the preference changes, so callers can persist it. */
  onPreferenceChange?: (preference: ThemePreference) => void;
}

export function ThemeProvider({
  children,
  initialPreference = 'system',
  onPreferenceChange,
}: ThemeProviderProps) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference);
  // null when the platform can't tell us (older Android, some web contexts) —
  // fall back to light, which is the direction's home ground.
  const systemScheme = useColorScheme();

  const mode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState((prev) => {
        if (prev !== next) onPreferenceChange?.(next);
        return next;
      });
    },
    [onPreferenceChange],
  );

  const toggle = useCallback(() => {
    setPreference(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, preference, colors: colorsFor(mode), setPreference, toggle }),
    [mode, preference, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Throws if used outside a ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
