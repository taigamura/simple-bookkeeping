/**
 * Motion tokens for Kaji — the durations, springs and curves every animation in
 * the app draws from, so motion reads as one system rather than per-component
 * taste.
 *
 * The direction follows Kippu's restraint (see docs/adr/0002): motion confirms
 * that something happened and points at where it happened, and then gets out of
 * the way. Nothing here loops, nothing decorates, and nothing blocks input.
 * A bookkeeping app is used in bursts of thirty seconds — an animation that
 * delights on the first save is an obstacle on the fiftieth.
 *
 * Three rules the values below encode:
 *
 * 1. **Press feedback is faster than thought** (`instant`, ~90ms). It must land
 *    before the finger lifts or it reads as lag, not response.
 * 2. **Travel scales with distance.** A chip recolouring uses `quick`; a whole
 *    screen crossfading uses `base`; the one thing that crosses the frame (the
 *    save wave) gets `wave` and is the only animation over 400ms.
 * 3. **Springs for anything a finger caused, timings for anything data caused.**
 *    A tap should feel physical; a number changing because the month changed
 *    should feel edited.
 *
 * Reduced motion is not handled here — see `MotionProvider`/`useMotion`. Every
 * consumer guards on that hook rather than these values being zeroed, because
 * the reduced-motion answer is usually "cut to the end state", not "same
 * animation, zero duration" (which still fires layout work and callbacks).
 *
 * ## `withAppTiming`/`withAppSpring` — and why every animation must use them
 *
 * Reanimated has its *own*, entirely separate reduced-motion gate: every
 * `withTiming`/`withSpring` call defaults to `ReduceMotion.System`, which
 * checks the OS/browser's reduce-motion flag itself and, when it's on, snaps
 * straight to the end value — silently, with only a one-time dev-mode console
 * warning ("Reduced motion setting is enabled on this device") to say so.
 *
 * This is a second gate *underneath* `useMotion()`, not the same one. Kaji's
 * `full`/`reduced`/`system` preference exists precisely so a user can
 * override the OS setting inside the app — but that override only ever
 * changed whether *this app's code* called `withTiming` at all. It never told
 * Reanimated to stop applying its own independent check on top. A user who
 * picked "Full" while their OS reports reduce-motion got exactly nothing:
 * `useMotion().enabled` was `true`, the call to `withTiming` happened, and
 * Reanimated silently reduced it anyway. Every animation in this app went
 * through this hole — found only because a real user on a real Chrome profile
 * with OS-level reduce-motion on reported the save wave was invisible, and it
 * took reading Reanimated's own console warning (not visible in this
 * project's Firefox-based verification, which never runs with reduce-motion
 * on) to find it.
 *
 * The fix: never call `withTiming`/`withSpring` directly. Use these wrappers,
 * which force `reduceMotion: ReduceMotion.Never`. That is safe *specifically
 * because* every call site is already inside an `if (enabled)` branch off
 * `useMotion()` — by the time either wrapper runs, the app has already made
 * its own decision to animate, folding in both the OS flag and the user's
 * override; Reanimated re-applying the OS flag a second time is exactly the
 * bug, not a safety net.
 *
 * The same applies to layout-animation builders (`FadeInDown`, `FadeOut`,
 * `LinearTransition`, …): they need `.reduceMotion(ReduceMotion.Never)`
 * chained on at every use, for the identical reason. There is no wrapper for
 * those — chain it explicitly at the call site.
 *
 * `withSequence` has *its own*, third independent reduce-motion gate on top
 * of whatever its individual sub-animations specify — forcing the inner
 * `withAppSpring`/`withAppTiming` calls is not enough on its own. Use
 * `withAppSequence` for the same reason as the other two.
 */
import {
  Easing,
  ReduceMotion,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type {
  AnimatableValue,
  AnimationCallback,
  WithSpringConfig,
  WithTimingConfig,
} from 'react-native-reanimated';

/**
 * Timing durations (ms). Only `wave` exceeds 400 — see rule 2 above.
 */
export const durations = {
  /** Press-in / press-out. Below the ~100ms threshold where touch feels lagged. */
  instant: 90,
  /** Small local changes: a chip fill, a segment slide, a dot resizing. */
  quick: 160,
  /** Two glyphs trading places without moving their surrounding layout. */
  symbolSwap: 200,
  /** Crossfades and slides at screen scale: tab swap, month commit. */
  base: 240,
  /** Number rolls and the day-list swap — long enough to read as a transition. */
  slow: 380,
  /** The save wave, and only the save wave. */
  wave: 620,
} as const;

/**
 * Spring configs for gesture-caused motion.
 *
 * Expressed as damping/stiffness/mass rather than `dampingRatio` + `duration`
 * so the same config behaves identically when a spring is interrupted mid-flight
 * (a second tap before the first settles), which the duration-based form does
 * not guarantee.
 */
export const springs = {
  /**
   * Press-in and press-out. Critically damped and very stiff: it should reach
   * the pressed scale essentially immediately and return with no visible
   * wobble, because a bouncing button under a finger reads as broken.
   */
  press: { damping: 20, stiffness: 420, mass: 0.6 },
  /**
   * Selection landing: the segmented pill sliding, a day cell becoming
   * selected, a chip taking the accent. Slightly underdamped so the arrival has
   * a little weight, not enough to overshoot visibly at these travel distances.
   */
  snap: { damping: 18, stiffness: 260, mass: 0.8 },
  /**
   * Larger travel where overshoot would be conspicuous — a sheet-scale element,
   * a bar growing to its full width.
   */
  gentle: { damping: 22, stiffness: 140, mass: 1 },
  /**
   * The one deliberately bouncy spring, reserved for the save landing pulse.
   * Underdamped enough to read as a "pop" — this is the app's single moment of
   * celebration and it is over in a third of a second.
   */
  pop: { damping: 12, stiffness: 220, mass: 0.7 },
} as const;

/**
 * Easing curves for data-caused motion.
 *
 * `standard` is an ease-out expo: nearly all the distance is covered in the
 * first third, so a change feels like it has already happened by the time the
 * eye arrives. It is the default for anything entering or settling.
 *
 * Note for tests: the reanimated jest mock stubs `Easing.bezier` to a factory
 * that ignores its arguments, so these are inert (but still valid) under jest.
 */
export const easings = {
  /** Ease-out expo. The default — entrances, settles, number rolls. */
  standard: Easing.bezier(0.22, 1, 0.36, 1),
  /** Ease-in. Exits only: things leaving should accelerate away. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** Symmetric ease-in-out, for a value that moves and comes back. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

/**
 * Scale factors for press feedback. Small targets need a proportionally larger
 * scale change to read at all; a 54px FAB pressing to .94 is clearly visible
 * where the same factor on a full-width CTA barely registers, hence two values.
 */
export const pressScale = {
  /** Small square controls: keypad keys, icon buttons, the FAB. */
  control: 0.94,
  /** Wide surfaces: the CTA, option tiles, list rows. */
  surface: 0.98,
} as const;

/**
 * Per-item delay for staggered entrances (ms), and the cap on how many items
 * are staggered before the rest arrive together. Without the cap, a month with
 * twelve spending categories would take a second and a half to finish drawing.
 */
export const stagger = {
  step: 40,
  max: 6,
} as const;

/** `stagger.step` applied to an index, saturating at `stagger.max` items. */
export const staggerDelay = (index: number): number =>
  Math.min(index, stagger.max) * stagger.step;

/** What the user chose for motion. `system` follows the OS reduce-motion flag. */
export type MotionPreference = 'system' | 'full' | 'reduced';

export const MOTION_PREFERENCES: readonly MotionPreference[] = [
  'system',
  'full',
  'reduced',
] as const;

export const isMotionPreference = (value: unknown): value is MotionPreference =>
  value === 'system' || value === 'full' || value === 'reduced';

/**
 * `withTiming`, forced to ignore Reanimated's own OS-level reduce-motion
 * check. See "`withAppTiming`/`withAppSpring`" above — use this everywhere
 * instead of importing `withTiming` from `react-native-reanimated` directly.
 */
export function withAppTiming<T extends AnimatableValue>(
  toValue: T,
  config?: WithTimingConfig,
  callback?: AnimationCallback,
): T {
  return withTiming(toValue, { ...config, reduceMotion: ReduceMotion.Never }, callback);
}

/**
 * `withSpring`, forced to ignore Reanimated's own OS-level reduce-motion
 * check. See "`withAppTiming`/`withAppSpring`" above — use this everywhere
 * instead of importing `withSpring` from `react-native-reanimated` directly.
 */
export function withAppSpring<T extends AnimatableValue>(
  toValue: T,
  config?: WithSpringConfig,
  callback?: AnimationCallback,
): T {
  'worklet';
  return withSpring(toValue, { ...config, reduceMotion: ReduceMotion.Never }, callback);
}

/**
 * `withSequence`, forced to ignore Reanimated's own OS-level reduce-motion
 * check — which `withSequence` carries *independently* of whatever its
 * sub-animations specify. See "`withAppTiming`/`withAppSpring`" above; use
 * this everywhere instead of importing `withSequence` directly. Its
 * sub-animations still need to be `withAppSpring`/`withAppTiming` themselves —
 * this only covers the sequence's own gate, not theirs.
 */
export function withAppSequence<T extends AnimatableValue>(...animations: T[]): T {
  return withSequence(ReduceMotion.Never, ...animations);
}
