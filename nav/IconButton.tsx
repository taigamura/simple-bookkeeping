/**
 * IconButton — the 34×34 soft-cornered nav button used across the shell
 * (⚙ settings, ‹ › month nav, ✕ close). Icons come from `@expo/vector-icons` by
 * intent, not literal Unicode (decision 6 — avoids Android tofu). Surface + icon
 * color read from the active theme so it works in both modes.
 *
 * Built on `PressScale` (`control` — it is one of the small square targets
 * that scale factor exists for) rather than a bare `Pressable`, for the same
 * reason as the keypad: this is the button behind month-nav chevrons, which
 * get tapped repeatedly in a row, and a scale-in reads as "received" faster
 * than the opacity dip alone did. The opacity dip stays on top of the scale —
 * it was already carrying the disabled-adjacent "acknowledged" cue and there
 * is no reason to replace a working signal, only to add a physical one.
 */
import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import type { CalendarView } from '../domain';
import { strings } from '../i18n';
import {
  durations,
  easings,
  metrics,
  useMotion,
  useTheme,
  withAppTiming,
  type Tone,
} from '../theme';
import { PressScale } from '../ui';

export interface IconButtonProps {
  /** Feather glyph name (mapped from the design's intent, e.g. 'settings'). */
  name: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  /** Icon tone from the palette. Defaults to muted. */
  tone?: Tone;
  /** Icon glyph size (px). The tap target stays 34×34. */
  size?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  name,
  onPress,
  tone = 'muted',
  size = 18,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <PressScale
      scale="control"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.card2, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Feather name={name} size={size} color={colors[tone]} />
    </PressScale>
  );
}

/**
 * The appearance control gets a local, causal transition on top of the global
 * fade-through. Both glyphs stay mounted and crossfade through a restrained
 * 45° turn, so a rapid second tap simply retargets the live progress value.
 */
export function ThemeToggleButton() {
  const { colors, targetMode, toggle } = useTheme();
  const { enabled } = useMotion();
  const darkProgress = useSharedValue(targetMode === 'dark' ? 1 : 0);

  useEffect(() => {
    const target = targetMode === 'dark' ? 1 : 0;
    darkProgress.value = enabled
      ? withAppTiming(target, { duration: durations.base, easing: easings.inOut })
      : target;
  }, [darkProgress, enabled, targetMode]);

  const moonStyle = useAnimatedStyle(() => ({
    opacity: 1 - darkProgress.value,
    transform: [{ rotate: `${darkProgress.value * 45}deg` }],
  }));
  const sunStyle = useAnimatedStyle(() => ({
    opacity: darkProgress.value,
    transform: [{ rotate: `${-45 + darkProgress.value * 45}deg` }],
  }));

  return (
    <PressScale
      scale="control"
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={
        targetMode === 'dark' ? strings.nav.useLightMode : strings.nav.useDarkMode
      }
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.card2, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.glyphStack}>
        <Animated.View style={[styles.glyph, moonStyle]}>
          <Feather name="moon" size={18} color={colors.muted} />
        </Animated.View>
        <Animated.View style={[styles.glyph, sunStyle]}>
          <Feather name="sun" size={18} color={colors.muted} />
        </Animated.View>
      </View>
    </PressScale>
  );
}

/** Calendar's hash/circle affordance mirrors the cells' 200ms symbol swap. */
export function CalendarViewToggleButton({
  view,
  onPress,
}: {
  view: CalendarView;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { enabled } = useMotion();
  const circleProgress = useSharedValue(view === 'numbers' ? 1 : 0);

  useEffect(() => {
    const target = view === 'numbers' ? 1 : 0;
    circleProgress.value = enabled
      ? withAppTiming(target, { duration: durations.symbolSwap, easing: easings.inOut })
      : target;
  }, [circleProgress, enabled, view]);

  const hashStyle = useAnimatedStyle(() => ({
    opacity: 1 - circleProgress.value,
    transform: [{ scale: 1 - circleProgress.value * 0.1 }],
  }));
  const circleStyle = useAnimatedStyle(() => ({
    opacity: circleProgress.value,
    transform: [{ scale: 0.9 + circleProgress.value * 0.1 }],
  }));

  return (
    <PressScale
      scale="control"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        view === 'dots' ? strings.calendar.showNumbers : strings.calendar.showDots
      }
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.card2, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.glyphStack}>
        <Animated.View style={[styles.glyph, hashStyle]}>
          <Feather name="hash" size={18} color={colors.muted} />
        </Animated.View>
        <Animated.View style={[styles.glyph, circleStyle]}>
          <Feather name="circle" size={18} color={colors.muted} />
        </Animated.View>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: metrics.navButton,
    height: metrics.navButton,
    borderRadius: metrics.navButtonRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphStack: { width: 18, height: 18 },
  glyph: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
