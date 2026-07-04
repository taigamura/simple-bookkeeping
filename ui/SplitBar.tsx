/**
 * SplitBar — the in/out proportion bar on the Summary net card. A single rounded
 * track split into an income (green) and an expense (red) segment sized by their
 * share of the combined flow. An empty month renders as a bare track.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, metrics, accents } from '../theme';

interface SplitBarProps {
  incomeFraction: number;
  expenseFraction: number;
}

export function SplitBar({ incomeFraction, expenseFraction }: SplitBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.bg }]}>
      <View
        style={{
          flex: incomeFraction,
          backgroundColor: accents.positive,
        }}
      />
      <View
        style={{
          flex: expenseFraction,
          backgroundColor: accents.negative,
        }}
      />
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
