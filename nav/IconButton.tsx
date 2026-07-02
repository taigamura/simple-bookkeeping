/**
 * IconButton — the round 34×34 nav button used across the shell (⚙ settings,
 * ‹ › month nav, ✕ close). Icons come from `@expo/vector-icons` by intent, not
 * literal Unicode (decision 6 — avoids Android tofu). Surface + icon color read
 * from the active theme so it works in both modes.
 */
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, metrics, type Tone } from '../theme';

export interface IconButtonProps {
  /** Feather glyph name (mapped from the design's intent, e.g. 'settings'). */
  name: React.ComponentProps<typeof Feather>['name'];
  onPress?: () => void;
  /** Icon tone from the palette/accents. Defaults to muted. */
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
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.card3, opacity: pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Feather name={name} size={size} color={colors[tone]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: metrics.navButton,
    height: metrics.navButton,
    borderRadius: metrics.navButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
