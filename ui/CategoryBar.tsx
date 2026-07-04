/**
 * CategoryBar — one ranked spending row on Summary: category label + amount on
 * top, a track bar below whose green fill is scaled to the largest category
 * (`fraction`). Track = `--card`, fill = `positive` per the design (§5); the
 * amount reads muted since these are all expenses.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { yen, DEFAULT_CURRENCY } from '../domain';
import { useTheme, metrics, accents, Txt } from '../theme';

interface CategoryBarProps {
  category: string;
  total: number;
  /** Bar fill in [0, 1], scaled to the largest category. */
  fraction: number;
  symbol?: string;
}

export function CategoryBar({
  category,
  total,
  fraction,
  symbol = DEFAULT_CURRENCY.symbol,
}: CategoryBarProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Txt variant="listItem" numberOfLines={1} style={styles.label}>
          {category}
        </Txt>
        <Txt variant="inlineAmount" tone="muted">
          {yen(total, symbol)}
        </Txt>
      </View>
      <View style={[styles.track, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: accents.positive, width: `${Math.max(0, Math.min(1, fraction)) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  label: { flex: 1 },
  track: {
    height: metrics.progressHeight,
    borderRadius: metrics.progressRadius,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: metrics.progressRadius },
});
