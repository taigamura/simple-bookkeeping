/**
 * SplitBar — the in/out proportion bar on the Summary net card. A single fully
 * rounded track split into an income and an expense segment sized by their
 * share of the combined flow. An empty month renders as a bare track.
 *
 * The Summary card is the saturated `deep` hero block, so the bar has an
 * on-deep treatment (`onDeep`): white for income, a translucent white for
 * expense, over a dimmed white track. Off the hero it uses the accent and a
 * muted ink for expense — red is reserved for things that are wrong.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, metrics } from '../theme';

interface SplitBarProps {
  incomeFraction: number;
  expenseFraction: number;
  /** Render for placement on the `deep` hero block. */
  onDeep?: boolean;
}

export function SplitBar({ incomeFraction, expenseFraction, onDeep = false }: SplitBarProps) {
  const { colors } = useTheme();
  const track = onDeep ? 'rgba(255,255,255,.20)' : colors.card3;
  const income = onDeep ? colors.onDeep : colors.positive;
  const expense = onDeep ? 'rgba(255,255,255,.42)' : colors.muted;

  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <View style={{ flex: incomeFraction, backgroundColor: income }} />
      <View style={{ flex: expenseFraction, backgroundColor: expense }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: metrics.progressHeight,
    borderRadius: metrics.progressRadius,
    overflow: 'hidden',
  },
});
