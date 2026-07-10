/**
 * CategoryBar — one ranked spending row on Summary: category label + amount on
 * top, a track bar below whose green fill is scaled to the largest category
 * (`fraction`). Track = `--card`, fill = `positive` per the design (§5); the
 * amount reads muted since these are all expenses. A budgeted category (#51)
 * shows "spent / budget" instead, and both fill and amount flip to the
 * negative accent once spending exceeds the budget.
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
  /** The category's monthly budget (#51); omit to render the plain bar. */
  budget?: number;
  symbol?: string;
}

export function CategoryBar({
  category,
  total,
  fraction,
  budget,
  symbol = DEFAULT_CURRENCY.symbol,
}: CategoryBarProps) {
  const { colors } = useTheme();
  const overBudget = budget !== undefined && total > budget;
  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Txt variant="listItem" numberOfLines={1} style={styles.label}>
          {category}
        </Txt>
        <Txt variant="inlineAmount" tone={overBudget ? 'negative' : 'muted'}>
          {budget !== undefined
            ? `${yen(total, symbol)} / ${yen(budget, symbol)}`
            : yen(total, symbol)}
        </Txt>
      </View>
      <View style={[styles.track, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: overBudget ? accents.negative : accents.positive,
              width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
            },
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
