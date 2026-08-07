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
export const ASSEMBLY_DURATION = 900;
export const EXIT_DURATION = 160;

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
      withAppTiming(1, { duration: 60 }),
      withAppTiming(0, { duration: 180, easing: easings.exit }),
    );
    topX.value = withAppSequence(
      withAppTiming(-18, { duration: 60 }),
      withAppTiming(0, { duration: 260, easing: easings.standard }),
    );
    topOpacity.value = withAppSequence(
      withAppTiming(0, { duration: 60 }),
      withAppTiming(1, { duration: 160, easing: easings.standard }),
    );
    lowerY.value = withAppSequence(
      withAppTiming(18, { duration: 250 }),
      withAppTiming(0, { duration: 290, easing: easings.standard }),
    );
    lowerOpacity.value = withAppSequence(
      withAppTiming(0, { duration: 250 }),
      withAppTiming(1, { duration: 170, easing: easings.standard }),
    );
    dotOpacity.value = withAppSequence(
      withAppTiming(0, { duration: 500 }),
      withAppTiming(1, { duration: 130, easing: easings.standard }),
    );
    dotScale.value = withAppSequence(
      withAppTiming(0.25, { duration: 500 }),
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
