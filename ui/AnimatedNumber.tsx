/**
 * AnimatedNumber — a money figure that ticks from its old value to its new one
 * instead of jumping.
 *
 * Used for the headline figures only: the Summary hero net, the Calendar
 * In/Out/Net strip, and the selected day's net. Amounts inside list rows stay
 * instant — a dozen numbers counting at once is noise, and the row amount is a
 * fact about one entry rather than a total that *changed*.
 *
 * The roll is what makes a month swap legible: −¥42,300 becoming −¥48,900 in
 * one frame is a new number, but the same change over 380ms is visibly the same
 * number moving, which is the thing the pager gesture is meant to convey.
 *
 * ## Why this animates on the JS thread
 *
 * Reanimated drives values on the UI thread, where the formatters cannot
 * follow: `yen`/`signed` call `Number.toLocaleString`, which is not
 * worklet-safe, so every frame would need a `runOnJS` hop back anyway. The
 * usual escape (animating an `AnimatedTextInput`'s `text` prop through
 * `useAnimatedProps`) would mean re-implementing comma grouping and the unicode
 * minus as a worklet, and would swap the `Txt` component — losing the theme
 * type variants — for a TextInput styled to look like text.
 *
 * A `requestAnimationFrame` loop re-rendering one `<Txt>` is the honest
 * version: ~23 renders of a single leaf node over the roll, no bridge traffic,
 * identical behaviour on native and web, and it composes with the existing
 * `Txt` variants and tones as a drop-in.
 *
 * ## Layout stability
 *
 * Every figure this renders is set in JetBrains Mono, so intermediate values
 * occupy the same advance width per digit and nothing reflows mid-roll. It is
 * only safe on mono variants for that reason — on a proportional face the
 * surrounding layout would shudder for the length of the animation.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { durations, useMotion, Txt, type Tone, type TypeVariant } from '../theme';

interface AnimatedNumberProps {
  /** The figure to display. Rolls whenever this changes. */
  value: number;
  /** Optional starting point for a deliberate first-appearance roll. */
  initialValue?: number;
  /** Renders a value as display text, e.g. `(n) => signed(n, symbol)`. */
  format: (value: number) => string;
  /** `Txt` type variant. Must be a monospace one — see "Layout stability". */
  variant: TypeVariant;
  /**
   * Whether value changes roll. Defaults to true. Set false where another
   * motion already owns the change — the Summary hero's pour fills the whole
   * card as one gesture (see `HeroPour`), and a per-figure digit-roll underneath
   * it would be a second, competing animation. With this off the figure cuts
   * straight to its new value, exactly as it does under reduced motion, so the
   * pour reveals a settled number rather than a spinning one.
   */
  roll?: boolean;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  testID?: string;
}

/**
 * Ease-out expo, matching `easings.standard`. Written out as a plain function
 * because that token is a reanimated `Easing.bezier` — a UI-thread object with
 * no callable JS form, and stubbed to identity under the jest mock besides.
 */
const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function AnimatedNumber({
  value,
  initialValue,
  format,
  variant,
  roll = true,
  tone,
  style,
  numberOfLines,
  testID,
}: AnimatedNumberProps) {
  const { enabled } = useMotion();
  const [display, setDisplay] = useState(initialValue ?? value);
  // The value currently on screen, read at the start of a roll. Kept in a ref
  // so an interrupted roll starts from where the last one actually got to,
  // rather than snapping back to its origin.
  const displayRef = useRef(initialValue ?? value);
  displayRef.current = display;

  useEffect(() => {
    if (!enabled || !roll) {
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    if (from === value) return;

    let frame = 0;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / durations.slow);
      const eased = easeOutExpo(t);
      // Round per frame: these are integer currency figures, and an unrounded
      // intermediate would render its full float expansion through toLocaleString.
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // displayRef is deliberately not a dependency: reading it at roll start is
    // the point, and depending on `display` would restart the roll every frame.
  }, [value, enabled, roll]);

  return (
    <Txt
      variant={variant}
      tone={tone}
      style={style}
      numberOfLines={numberOfLines}
      testID={testID}
    >
      {format(display)}
    </Txt>
  );
}
