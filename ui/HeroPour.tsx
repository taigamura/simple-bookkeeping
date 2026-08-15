/**
 * HeroPour — the Summary hero fills like a vessel when its figures change.
 *
 * On a period swap (or first appearance), a translucent water plane rises from
 * the bottom of the `deep` hero block to past its top, a brighter meniscus line
 * riding its surface, while the card's contents rise the last few pixels into
 * place and resolve to full strength. The net, the in/out legend and the
 * budget-left line all arrive on that one rising front rather than each
 * animating on its own — the hero is one vessel being poured, not four numbers
 * being replaced. This is why the figures inside pass `roll={false}` to
 * `AnimatedNumber` (see its `roll` prop): the pour is the change's motion, and a
 * per-figure digit-roll underneath it would be a second, competing animation.
 *
 * ## Why a rising veil and a content rise, not a masked reveal
 *
 * The literal reading of "fill bottom-up" is a hard clip: render the bright
 * content twice and reveal the top copy through a growing window. That needs a
 * second, duplicated instance of the whole hero (two `AnimatedNumber`s per
 * figure, duplicate testIDs, a `SplitBar` springing in two places) and a
 * mask primitive this app does not depend on. The veil-plus-rise version gets
 * the same read — a bright front sweeping up the card — from one instance and
 * two plain animated styles, at the cost of the reveal being a translucent wash
 * over the content rather than a crisp cut. On the saturated hero that wash is
 * nearly invisible anyway; the meniscus line is what the eye actually tracks.
 *
 * ## Colour
 *
 * The fill is white-translucent, not the accent: the hero ground *is* the
 * accent (`colors.deep`), so an accent-coloured pour would be invisible on it.
 * This matches how `SplitBar` renders its on-deep treatment in white.
 *
 * Measures its own height from layout; until it has one it renders the children
 * plainly with no overlay, so the very first frame (before measurement) is never
 * blank. The pour then fires as soon as a measurement lands.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { durations, easings, useMotion, withAppTiming } from '../theme';

interface HeroPourProps {
  /**
   * Replay key. Any change (and the first non-empty value) plays the pour once.
   * The Summary passes the period key so every period swap pours afresh.
   */
  trigger: string | number;
  /** Corner radius to clip the rising fill to — the hero's own radius. */
  radius: number;
  children: React.ReactNode;
  testID?: string;
}

/** How far (px) the contents rise into place as the fill sweeps up. */
const RISE_DISTANCE = 12;
/** The contents' starting opacity, lifted to full as the pour completes. */
const CONTENT_DIM = 0.55;
/** Fill colour and its meniscus — white-translucent, to read on the deep hero. */
const WATER = 'rgba(255,255,255,0.13)';
const MENISCUS = 'rgba(255,255,255,0.5)';

export function HeroPour({ trigger, radius, children, testID }: HeroPourProps) {
  const { enabled } = useMotion();
  const [height, setHeight] = useState(0);
  // The fraction of the card the fill has risen through; overshoots past 1 so
  // the meniscus exits the top rather than parking on it.
  const level = useSharedValue(0);
  // The veil's own opacity, so the wash clears once the pour lands and leaves no
  // residual tint over the figures.
  const veil = useSharedValue(0);
  // 0 → 1 drives the content's rise and settle.
  const rise = useSharedValue(1);
  // The trigger value the current on-screen state was last animated for, so a
  // re-measure (height arriving after mount) does not replay a pour already run.
  const lastPlayed = useRef<string | number | null>(null);

  useEffect(() => {
    if (!enabled) {
      // No pour: contents fully present, overlay invisible.
      level.value = 0;
      veil.value = 0;
      rise.value = 1;
      lastPlayed.current = trigger;
      return;
    }
    // Wait for a measurement before the first pour so the fill has a height to
    // grow through; the effect re-runs when `height` lands.
    if (height === 0) return;
    if (lastPlayed.current === trigger) return;
    lastPlayed.current = trigger;

    level.value = 0;
    veil.value = 1;
    rise.value = 0;
    level.value = withAppTiming(1.08, { duration: durations.slow, easing: easings.standard });
    // Ease-in fade: the veil holds near full through the rise, then drops fast
    // as the front reaches the top — so the wash is present while it travels and
    // gone by the time it settles.
    veil.value = withAppTiming(0, { duration: durations.slow, easing: easings.exit });
    rise.value = withAppTiming(1, { duration: durations.slow, easing: easings.standard });
  }, [trigger, enabled, height, level, veil, rise]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    if (next !== height) setHeight(next);
  };

  const contentStyle = useAnimatedStyle(() => ({
    opacity: CONTENT_DIM + rise.value * (1 - CONTENT_DIM),
    transform: [{ translateY: (1 - rise.value) * RISE_DISTANCE }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  const fillStyle = useAnimatedStyle(() => ({ height: level.value * height }));

  return (
    <View onLayout={onLayout} testID={testID ? `${testID}-root` : undefined}>
      <Animated.View style={contentStyle}>{children}</Animated.View>
      {enabled && height > 0 && (
        <Animated.View
          testID={testID}
          pointerEvents="none"
          style={[styles.overlay, { borderRadius: radius }, overlayStyle]}
        >
          <Animated.View
            style={[
              styles.fill,
              { backgroundColor: WATER, borderTopColor: MENISCUS },
              fillStyle,
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Clips the rising fill to the card's rounded box; never eats touches.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  // Anchored to the bottom edge; its top border is the meniscus line.
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1.5,
  },
});
