/**
 * Txt — the single text primitive for Kaji.
 *
 * Combines a typography variant from the type scale with a theme-driven color
 * "tone". Keeps every screen off raw `Text` + hardcoded hex, so the mono/sans
 * split and the palette stay consistent.
 *
 *   <Txt variant="screenTitle">Summary</Txt>
 *   <Txt variant="microLabel" tone="muted">INCOME</Txt>
 *   <Txt variant="inlineAmount" tone="positive">+1,200</Txt>
 */
import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import { type, type TypeVariant } from './tokens';

/** Semantic text colors. `ink`/`muted`/`dim` come from the palette; the rest
 *  from shared accents. */
export type Tone =
  | 'ink'
  | 'muted'
  | 'dim'
  | 'positive'
  | 'negative'
  | 'onPositive';

export interface TxtProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
}

export function Txt({
  variant = 'listItem',
  tone = 'ink',
  style,
  ...rest
}: TxtProps) {
  const { colors } = useTheme();
  return (
    <Text
      style={[type[variant] as object, { color: colors[tone] }, style]}
      {...rest}
    />
  );
}

/** Convenience: the app's default screen background, for quick container use. */
export const useScreenStyle = () => {
  const { colors } = useTheme();
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
  });
};
