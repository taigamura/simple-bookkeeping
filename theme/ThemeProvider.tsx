/**
 * ThemeProvider — supplies the active color palette and appearance switching.
 *
 * Supersedes build-decision 9 (manual only). The user picks a *preference* —
 * `system`, `light` or `dark` — and `system` resolves against the OS via
 * `useColorScheme`, re-resolving live when the device flips. `targetMode` is
 * the latest resolved request; `mode` is the palette actually on screen (it
 * trails until the midpoint of an animated fade-through); `preference` is what
 * Settings shows as selected.
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
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  AppState,
  Easing,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';

import { useMotion } from './MotionProvider';
import { durations } from './motion';
import {
  colorsFor,
  type Colors,
  type ThemeMode,
  type ThemePreference,
} from './tokens';

interface ThemeContextValue {
  /** The appearance actually rendered — `system` already resolved. */
  mode: ThemeMode;
  /** The latest requested appearance; leads `mode` during a fade-through. */
  targetMode: ThemeMode;
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
  const { enabled: motionEnabled } = useMotion();
  // null when the platform can't tell us (older Android, some web contexts) —
  // fall back to light, which is the direction's home ground.
  const systemScheme = useColorScheme();

  const targetMode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const [mode, setMode] = useState<ThemeMode>(targetMode);

  // Appearance changes are a 240ms fade-through: the old composition fades
  // away, the palette commits while it is invisible, then the new composition
  // fades in. The outer ground adopts the target color immediately, so the
  // midpoint is the destination surface rather than an unthemed flash.
  const opacity = useRef(new Animated.Value(1)).current;
  const modeRef = useRef(mode);
  const targetModeRef = useRef(targetMode);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const generationRef = useRef(0);
  const transitionActiveRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const resumedAtRef = useRef(0);

  targetModeRef.current = targetMode;

  const animateOpacity = useCallback(
    (toValue: number, generation: number, onFinished?: () => void) => {
      const animation = Animated.timing(opacity, {
        toValue,
        duration: durations.base / 2,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      });
      animationRef.current = animation;
      animation.start(({ finished }) => {
        if (finished && generation === generationRef.current) onFinished?.();
      });
    },
    [opacity],
  );

  const commitImmediately = useCallback(
    (nextMode: ThemeMode) => {
      generationRef.current += 1;
      animationRef.current?.stop();
      opacity.setValue(1);
      transitionActiveRef.current = false;
      modeRef.current = nextMode;
      setMode(nextMode);
    },
    [opacity],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;
      if (nextState === 'active' && !wasActive) {
        // useColorScheme may publish the resumed OS appearance on the next
        // frame. Suppress motion briefly so resume is already settled.
        resumedAtRef.current = Date.now();
        if (targetModeRef.current !== modeRef.current) {
          commitImmediately(targetModeRef.current);
        }
      }
    });
    return () => subscription.remove();
  }, [commitImmediately]);

  useEffect(() => {
    const shouldSettleImmediately =
      !motionEnabled ||
      appStateRef.current !== 'active' ||
      Date.now() - resumedAtRef.current < durations.base;

    if (shouldSettleImmediately) {
      commitImmediately(targetMode);
      return;
    }

    const generation = generationRef.current + 1;

    // A second tap that returns to the palette still on screen reverses the
    // fade from its live opacity instead of completing a now-stale switch.
    if (targetMode === modeRef.current) {
      if (!transitionActiveRef.current) return;
      generationRef.current = generation;
      animationRef.current?.stop();
      animateOpacity(1, generation, () => {
        transitionActiveRef.current = false;
      });
      return;
    }

    generationRef.current = generation;
    transitionActiveRef.current = true;
    animationRef.current?.stop();
    animateOpacity(0, generation, () => {
      const latest = targetModeRef.current;
      if (latest === modeRef.current) {
        animateOpacity(1, generation);
        return;
      }

      modeRef.current = latest;
      setMode(latest);
      // Give React one frame to commit the new palette (and status-bar style)
      // before revealing it. Input is never disabled during either half.
      requestAnimationFrame(() => {
        if (generation === generationRef.current) {
          animateOpacity(1, generation, () => {
            transitionActiveRef.current = false;
          });
        }
      });
    });
  }, [animateOpacity, commitImmediately, motionEnabled, targetMode]);

  useEffect(
    () => () => {
      generationRef.current += 1;
      animationRef.current?.stop();
    },
    [],
  );

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
    setPreference(targetMode === 'dark' ? 'light' : 'dark');
  }, [targetMode, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, targetMode, preference, colors: colorsFor(mode), setPreference, toggle }),
    [mode, preference, setPreference, targetMode, toggle],
  );

  return (
    <View style={[styles.ground, { backgroundColor: colorsFor(targetMode).bg }]}>
      <ThemeContext.Provider value={value}>
        <Animated.View style={[styles.composition, { opacity }]}>{children}</Animated.View>
      </ThemeContext.Provider>
    </View>
  );
}

/** Access the active theme. Throws if used outside a ThemeProvider. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

const styles = StyleSheet.create({
  ground: { flex: 1 },
  composition: { flex: 1 },
});
