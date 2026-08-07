import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import {
  easings,
  springs,
  useMotion,
  withAppSequence,
  withAppSpring,
  withAppTiming,
} from '../theme';
import { useTheme } from '../theme/ThemeProvider';
import { strings } from '../i18n';

const lightIcon = require('../assets/splash-icon.png');
const darkIcon = require('../assets/splash-icon-dark.png');

/** The native splash uses a 200pt image whose mark occupies 80% of its width. */
const NATIVE_IMAGE_SIZE = 200;
const MARK_WIDTH = NATIVE_IMAGE_SIZE * 0.8;
const MARK_SCALE = MARK_WIDTH / 30;
const BAR_HEIGHT = 9 * MARK_SCALE;
const MARK_HEIGHT = 23 * MARK_SCALE;
const LOWER_TOP = 14 * MARK_SCALE;
const LOWER_WIDTH = 18 * MARK_SCALE;
const DOT_SIZE = 9 * MARK_SCALE;

/** Time for all three pieces to land; the exit is a separate short crossfade. */
export const ASSEMBLY_DURATION = 950;
export const EXIT_DURATION = 160;

/**
 * When each piece begins, measured from the start of the assembly (ms).
 *
 * These are gathered here because the one thing that matters about them is
 * their relationship to `HANDOFF_HOLD + HANDOFF_FADE` — the moment the native
 * splash raster finishes clearing. That raster is an opaque picture of the
 * *finished* mark, so any piece that animates before it clears is animating
 * underneath a copy of itself, at its own destination, and cannot be seen to
 * move at all.
 *
 * The top bar used to start at 60ms, and that is precisely what made it look
 * like it jumped in rather than travelled. Measured against the real curves:
 * by 180ms it had already covered 95% of its 18px (ease-out expo spends ~85%
 * of its distance in the first third) while the raster was still 48% opaque;
 * by the time the raster cleared at 240ms it sat 0.1px from home. There was
 * nothing left to watch, so the eye could only register it as appearing.
 *
 * The lower bar and the dot never had this problem — they started at 250ms and
 * 500ms, both after the raster was gone, which is why those two read correctly
 * and the first one did not. So the fix is to give the top bar the same
 * courtesy and then re-space the other two to keep an even cadence.
 *
 * The top bar's fade-in still overlaps the raster's tail (it starts while that
 * is ~33% opaque) so the stage is never momentarily empty; it is only the
 * *travel* that has to outlast the raster. `easings.screen` rather than
 * `easings.standard` for the same reason it exists on the tab swap: a curve
 * that front-loads its distance turns a slide into an appearance.
 */
const HANDOFF_HOLD = 60;
const HANDOFF_FADE = 180;
const TOP_START = 200;
const TOP_TRAVEL = 340;
const LOWER_START = 430;
const LOWER_TRAVEL = 290;
const DOT_START = 660;

/**
 * The assembly timeline, exported so the raster-occlusion invariant above can
 * be asserted rather than left as a comment that drifts. `handoffClear` is the
 * moment the splash raster stops hiding the stage; every piece's *travel* has
 * to outlast it by enough to be worth watching.
 */
export const TIMELINE = {
  handoffClear: HANDOFF_HOLD + HANDOFF_FADE,
  top: { start: TOP_START, travel: TOP_TRAVEL },
  lower: { start: LOWER_START, travel: LOWER_TRAVEL },
  dot: { start: DOT_START },
} as const;

interface LoadingScreenProps {
  /** The Calendar is mounted behind this screen and can safely be revealed. */
  ready: boolean;
  /** Called after the mark has assembled and this screen has faded away. */
  onFinished: () => void;
}

/**
 * Native-splash handoff and Kippu mark assembly.
 *
 * The first React frame is the exact same 200pt raster as the native splash,
 * avoiding the old 200→112 size jump. It crossfades into geometry at the same
 * apparent 160pt mark size: top bar from the left, lower bar from below, then
 * the punched dot with one restrained spring. Once the app is genuinely ready,
 * this overlay fades to the already-mounted Calendar. Reduced Motion renders
 * the complete raster and reveals Calendar without scheduling any animation.
 *
 * The handoff raster is the constraint that shapes the whole assembly: it is a
 * picture of the mark already built, so nothing can be seen to arrive until it
 * has gone. See `TOP_START` for the timing that follows from that, and for the
 * bug it fixes.
 */
export function LoadingScreen({ ready, onFinished }: LoadingScreenProps) {
  const { colors, mode } = useTheme();
  const { enabled, resolved } = useMotion();
  const [assemblyComplete, setAssemblyComplete] = useState(resolved && !enabled);
  const onFinishedRef = useRef(onFinished);

  const handoffOpacity = useSharedValue(1);
  const topX = useSharedValue(-18);
  const topOpacity = useSharedValue(0);
  const lowerY = useSharedValue(18);
  const lowerOpacity = useSharedValue(0);
  const dotScale = useSharedValue(0.25);
  const dotOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    screenOpacity.value = 1;

    if (!resolved) {
      handoffOpacity.value = 1;
      topOpacity.value = 0;
      lowerOpacity.value = 0;
      dotOpacity.value = 0;
      setAssemblyComplete(false);
      return;
    }

    if (!enabled) {
      handoffOpacity.value = 1;
      topOpacity.value = 0;
      lowerOpacity.value = 0;
      dotOpacity.value = 0;
      setAssemblyComplete(true);
      return;
    }

    setAssemblyComplete(false);
    handoffOpacity.value = 1;
    topX.value = -18;
    topOpacity.value = 0;
    lowerY.value = 18;
    lowerOpacity.value = 0;
    dotScale.value = 0.25;
    dotOpacity.value = 0;

    // The first short hold guarantees iOS paints one matching handoff frame.
    handoffOpacity.value = withAppSequence(
      withAppTiming(1, { duration: HANDOFF_HOLD }),
      withAppTiming(0, { duration: HANDOFF_FADE, easing: easings.exit }),
    );
    // Travel is deliberately longer than the other two pieces and runs on the
    // decelerate curve: it starts while the raster is still ~a third visible,
    // so most of its distance has to remain unspent until that has cleared.
    topX.value = withAppSequence(
      withAppTiming(-18, { duration: TOP_START }),
      withAppTiming(0, { duration: TOP_TRAVEL, easing: easings.screen }),
    );
    topOpacity.value = withAppSequence(
      withAppTiming(0, { duration: TOP_START }),
      withAppTiming(1, { duration: 200, easing: easings.standard }),
    );
    lowerY.value = withAppSequence(
      withAppTiming(18, { duration: LOWER_START }),
      withAppTiming(0, { duration: LOWER_TRAVEL, easing: easings.standard }),
    );
    lowerOpacity.value = withAppSequence(
      withAppTiming(0, { duration: LOWER_START }),
      withAppTiming(1, { duration: 170, easing: easings.standard }),
    );
    dotOpacity.value = withAppSequence(
      withAppTiming(0, { duration: DOT_START }),
      withAppTiming(1, { duration: 130, easing: easings.standard }),
    );
    dotScale.value = withAppSequence(
      withAppTiming(0.25, { duration: DOT_START }),
      withAppSpring(1, springs.snap),
    );

    const timer = setTimeout(() => setAssemblyComplete(true), ASSEMBLY_DURATION);
    return () => clearTimeout(timer);
    // Reanimated shared values have stable identity by contract; the motion
    // decision is the only input that should restart the assembly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resolved]);

  useEffect(() => {
    if (!resolved || !ready || !assemblyComplete) return;

    if (!enabled) {
      onFinishedRef.current();
      return;
    }

    screenOpacity.value = withAppTiming(0, {
      duration: EXIT_DURATION,
      easing: easings.exit,
    });
    const timer = setTimeout(() => onFinishedRef.current(), EXIT_DURATION);
    return () => clearTimeout(timer);
    // `screenOpacity` is a stable Reanimated shared value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assemblyComplete, enabled, ready, resolved]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const handoffStyle = useAnimatedStyle(() => ({ opacity: handoffOpacity.value }));
  const topStyle = useAnimatedStyle(() => ({
    opacity: topOpacity.value,
    transform: [{ translateX: topX.value }],
  }));
  const lowerStyle = useAnimatedStyle(() => ({
    opacity: lowerOpacity.value,
    transform: [{ translateY: lowerY.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View
      testID="loading-screen"
      accessible
      accessibilityLabel={strings.a11y.loadingKaji}
      style={[styles.root, { backgroundColor: colors.bg }, screenStyle]}
    >
      <View style={styles.markStage}>
        <Animated.Image
          testID="splash-handoff-icon"
          source={mode === 'dark' ? darkIcon : lightIcon}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={[styles.handoffIcon, handoffStyle]}
        />
        <View style={styles.mark} accessibilityElementsHidden>
          <Animated.View
            style={[styles.topBar, { backgroundColor: colors.positive }, topStyle]}
          />
          <Animated.View
            style={[
              styles.lowerBar,
              { backgroundColor: colors.brandSecondary },
              lowerStyle,
            ]}
          />
          <Animated.View
            style={[styles.dot, { backgroundColor: colors.positive }, dotStyle]}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markStage: {
    width: NATIVE_IMAGE_SIZE,
    height: NATIVE_IMAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoffIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: NATIVE_IMAGE_SIZE,
    height: NATIVE_IMAGE_SIZE,
  },
  mark: {
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: MARK_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
  lowerBar: {
    position: 'absolute',
    left: 0,
    top: LOWER_TOP,
    width: LOWER_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
  dot: {
    position: 'absolute',
    right: 0,
    top: LOWER_TOP,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
