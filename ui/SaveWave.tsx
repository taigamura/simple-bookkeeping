/**
 * SaveWave — the accent bloom that confirms a saved entry.
 *
 * A circle of the theme accent originates at the CTA that was just pressed and
 * expands past the edges of its container while fading out. It is the app's one
 * piece of celebratory motion, and it exists because saving an entry is the
 * only thing this app is *for*: every other interaction is navigation, and
 * navigation should be silent.
 *
 * ## Why it is scoped to the app canvas
 *
 * The obvious version of this effect (Strava's) covers the whole display. That
 * reads beautifully once. At thirty saves a day it is thirty half-second
 * blackouts of the interface, and the thing being obscured is the ledger the
 * user is trying to check. The bloom therefore lives in the app shell's visual
 * canvas, not the sheet that launched it. It can finish while the sheet is
 * dismissing and remains mounted after the sheet unmounts. The *arrival* is
 * signalled somewhere else entirely — a pulse on the day cell the entry landed
 * on (see `DayCell`'s `pulse` prop).
 *
 * ## Why two independent tracks
 *
 * `spread` and `fade` are separate shared values on different curves. Sharing
 * one progress value would tie the fade to the spread, which finishes early
 * (see below) — the circle would be gone before it had visibly travelled.
 * The fade runs closer to linear over the full duration instead, so the color
 * lingers long enough to register as color.
 *
 * ## Why spread eases *in*, not out
 *
 * This was originally an ease-out curve ("rushes outward fast, so it reads as
 * force"), which was wrong: ease-out concentrates most of the size change in
 * the first frames by definition, and the oversized diameter below (see
 * "Sizing") means even a small fraction of that curve already exceeds the
 * container's width. Measured directly (sampling the rendered `transform` on
 * every animation frame): the circle passed the viewport's edges by ~120ms,
 * roughly a fifth of the way through its own animation. The scale value *was*
 * still changing after that — the animation was technically running the whole
 * time — but nothing on screen looked like it, because there was no longer any
 * edge left to see move. It read as a flash, not a wave, which is the whole
 * point of the effect.
 *
 * Easing *in* (slow start, fast finish) keeps the circle small — genuinely
 * smaller than the frame — for a real fraction of the animation, so there is
 * something for the eye to track before it floods. The fast finish still
 * lands with force at the moment it completes; only the visible journey to get
 * there changed.
 *
 * ## Sizing
 *
 * The circle is measured from its own layout — it fills its parent absolutely,
 * so `onLayout` reports the parent's box. The full-grown diameter is oversized
 * to ~2.2× the larger dimension because the origin sits near the bottom edge,
 * not the center: a circle merely as wide as the container would leave the top
 * corners uncovered at full spread.
 *
 * Renders nothing at all until it has been fired once and has a measurement,
 * so it costs nothing on every other frame of the sheet's life.
 *
 * ## Why growth is real `width`/`height`, not `transform: scale`
 *
 * The obvious way to animate a growing circle is a fixed-size box scaled up
 * via `transform`, which was the original implementation. When a Chromium
 * user reported the wave invisible after every other fix, the working theory
 * here was a Chromium-specific compositing bug: `transform` is
 * compositor-only, and a browser can skip repainting the layer underneath it
 * when the *unscaled* box already vastly exceeds its `overflow: hidden`
 * ancestor (true here — the full-grown box is ~2.2× the container). That
 * theory turned out to be a red herring: the actual bug was that Reanimated's
 * own reduce-motion gate (see `theme/motion.ts`, `withAppTiming`) was
 * silently snapping every `withTiming` call straight to its end value on that
 * user's machine, which would have made the *old* transform-based version
 * just as invisible — the animated property was never the variable.
 *
 * Kept anyway, on its own merit rather than as "the fix": animating real
 * layout properties means every frame is a genuine paint, which cannot be
 * silently skipped by any compositor optimization, at a cost (real
 * layout+paint instead of a compositor-only transform) that is irrelevant for
 * one circle animating once per save. `opacity` stays a plain style property
 * either way — it was never implicated in the clipping theory, since it
 * doesn't interact with the ancestor's `overflow: hidden` clip the way size
 * does.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { durations, easings, metrics, useMotion, withAppTiming } from '../theme';

interface SaveWaveProps {
  /**
   * Fire counter. Any change to a non-zero value plays the bloom once; `0`
   * means idle. A nonce rather than a boolean so that two saves in a row both
   * animate — a boolean would need an explicit reset frame between them.
   */
  nonce: number;
  /** Bloom color — the theme accent at the call site. */
  color: string;
  /**
   * Distance from the container's bottom edge up to the bloom's origin.
   * Defaults to the middle of a CTA sitting flush at the bottom, which is
   * where every current caller launches it from.
   */
  originFromBottom?: number;
  testID?: string;
}

export function SaveWave({
  nonce,
  color,
  originFromBottom = metrics.ctaHeight / 2,
  testID,
}: SaveWaveProps) {
  const { enabled } = useMotion();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const spread = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (!enabled || nonce === 0) return;
    // Reset to the origin before firing, so a second save restarts the bloom
    // rather than continuing the first one's flight.
    spread.value = 0;
    fade.value = 0.9;
    spread.value = withAppTiming(1, {
      duration: Math.round(durations.wave * 0.7),
      // Ease in, not out — see the file header ("Why spread eases in, not
      // out"). An ease-out curve here made the growth phase disappear.
      easing: easings.exit,
    });
    fade.value = withAppTiming(0, { duration: durations.wave, easing: easings.inOut });
  }, [nonce, enabled, spread, fade]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  // The fully-grown diameter. Closed over by the worklet below as a plain
  // number — recomputed each render from `box`, same as any other render-time
  // constant — not a shared value, since it never needs to change mid-flight.
  const fullDiameter = Math.max(box.width, box.height) * 2.2;

  const animatedStyle = useAnimatedStyle(() => {
    // Starts as a dot at the CTA rather than at literal zero: a diameter of 0
    // has no defined center to grow from, and the first visible frame should
    // already read as a mark, not a point.
    const size = fullDiameter * (0.04 + spread.value);
    return {
      opacity: fade.value,
      width: size,
      height: size,
      borderRadius: size / 2,
      // Recomputed every frame (not just once at full size) so the shrinking
      // box keeps its center pinned to the same origin point the fixed-size
      // version got for free from `transform: scale`'s default center-origin.
      left: box.width / 2 - size / 2,
      bottom: originFromBottom - size / 2,
    };
  });

  const shouldRenderCircle = enabled && nonce > 0 && fullDiameter > 0;

  return (
    <Animated.View
      // Never intercepts touches: the CTA underneath stays reachable, and the
      // sheet's own dismissal gestures keep working through the bloom.
      pointerEvents="none"
      testID={testID}
      onLayout={onLayout}
      style={styles.host}
    >
      {shouldRenderCircle && (
        <Animated.View
          style={[{ position: 'absolute', backgroundColor: color }, animatedStyle]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Fills the app canvas without claiming the OS-owned status-bar or home-
  // indicator regions. The host is inside AppShell's safe-area canvas.
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 1000,
    elevation: 1000,
  },
});
