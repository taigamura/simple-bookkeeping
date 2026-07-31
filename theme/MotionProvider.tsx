/**
 * MotionProvider — decides whether the app animates, and supplies that one
 * boolean to every component through `useMotion()`.
 *
 * Mirrors ThemeProvider's shape deliberately: the user picks a *preference* —
 * `system`, `full` or `reduced` — and `system` resolves against the OS
 * reduce-motion accessibility setting, re-resolving live when the device flips.
 * `enabled` is the concrete answer components act on; `preference` is what
 * Settings shows as selected. Storage-agnostic for the same reason: it takes an
 * `initialPreference` and reports changes via `onPreferenceChange`, and `App`
 * plugs the store into those two props.
 *
 * Why not reanimated's own `useReducedMotion()`: it only reads the OS flag, so
 * it cannot express "the OS says animate but this user turned it off in Kaji" —
 * and it is absent from `react-native-reanimated/mock`, so importing it would
 * break every existing component test. `AccessibilityInfo` is a plain RN API
 * that the jest preset already stubs.
 *
 * Consumers should branch on `enabled` rather than animate to a zero duration:
 * a zeroed animation still schedules layout work and still fires completion
 * callbacks a frame late, and for several of these (the save wave, the number
 * roll) the reduced-motion answer is "render the end state and nothing else".
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';

import type { MotionPreference } from './motion';

interface MotionContextValue {
  /** Whether to animate at all — the `system` preference already resolved. */
  enabled: boolean;
  /** What the user selected; `system` stays `system` here. */
  preference: MotionPreference;
  /** True when the OS reduce-motion setting is on, whatever the preference. */
  systemReducedMotion: boolean;
  setPreference: (preference: MotionPreference) => void;
}

const MotionContext = createContext<MotionContextValue | null>(null);

interface MotionProviderProps {
  children: React.ReactNode;
  /** Starting preference (e.g. restored from storage). Defaults to `system`. */
  initialPreference?: MotionPreference;
  /** Called whenever the preference changes, so callers can persist it. */
  onPreferenceChange?: (preference: MotionPreference) => void;
}

export function MotionProvider({
  children,
  initialPreference = 'system',
  onPreferenceChange,
}: MotionProviderProps) {
  const [preference, setPreferenceState] =
    useState<MotionPreference>(initialPreference);
  const systemReducedMotion = useSystemReducedMotion();

  const setPreference = useCallback(
    (next: MotionPreference) => {
      setPreferenceState((prev) => {
        if (prev !== next) onPreferenceChange?.(next);
        return next;
      });
    },
    [onPreferenceChange],
  );

  const enabled =
    preference === 'system' ? !systemReducedMotion : preference === 'full';

  const value = useMemo<MotionContextValue>(
    () => ({ enabled, preference, systemReducedMotion, setPreference }),
    [enabled, preference, systemReducedMotion, setPreference],
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

/**
 * The OS reduce-motion flag, kept live.
 *
 * Starts `false` (animate) and corrects itself once the async initial read
 * lands — the alternative, starting `true`, would suppress the first frame of
 * animation for every user on every launch to spare a single frame for the few
 * who have the setting on. The `cancelled` guard keeps a slow read from writing
 * state into an unmounted provider.
 *
 * Every platform this ships to is covered: iOS/Android implement the event
 * natively, and react-native-web maps it onto the
 * `(prefers-reduced-motion: reduce)` media query.
 */
function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (!cancelled) setReduced(value);
      })
      // Reading the flag is best-effort; a platform that cannot answer keeps
      // the animate-by-default assumption rather than erroring on boot.
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value: boolean) => setReduced(value),
    );

    return () => {
      cancelled = true;
      // RN ≥0.65 returns a subscription with remove(); guarded because the jest
      // environment and older web shims can return undefined here.
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}

/**
 * Whether the app should animate, plus the preference controls.
 *
 * Deliberately does NOT throw when used outside a provider, unlike `useTheme`.
 * Motion is an enhancement: a component rendered in a test harness or a
 * throwaway prototype without the provider should quietly render un-animated
 * rather than crash. Theme has no such fallback because a component with no
 * colors is not a degraded experience, it is an invisible one.
 */
export function useMotion(): MotionContextValue {
  return (
    useContext(MotionContext) ?? {
      enabled: false,
      preference: 'system' as const,
      systemReducedMotion: false,
      setPreference: () => {},
    }
  );
}
