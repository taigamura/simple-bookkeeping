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
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, metrics, type Tone } from '../theme';
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

const styles = StyleSheet.create({
  button: {
    width: metrics.navButton,
    height: metrics.navButton,
    borderRadius: metrics.navButtonRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
