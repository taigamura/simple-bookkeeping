/**
 * ThemeProvider — supplies the active color palette and mode switching.
 *
 * Decision 9: dark by default, manual only (OS appearance ignored — no
 * `useColorScheme`). The choice is meant to persist; persistence is wired in
 * Stage 3 (AsyncStorage store). For now the provider accepts an `initialMode`
 * and reports changes via `onModeChange` so the store can plug in without a
 * rewrite.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { colorsFor, type Colors, type ThemeMode } from './tokens';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Starting mode (e.g. restored from storage). Defaults to dark. */
  initialMode?: ThemeMode;
  /** Called whenever the mode changes, so callers can persist it. */
  onModeChange?: (mode: ThemeMode) => void;
}

export function ThemeProvider({
  children,
  initialMode = 'dark',
  onModeChange,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState((prev) => {
        if (prev !== next) onModeChange?.(next);
        return next;
      });
    },
    [onModeChange],
  );

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, colors: colorsFor(mode), setMode, toggle }),
    [mode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme. Throws if used outside a ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
