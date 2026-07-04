/**
 * ListRow — one entry in the day list. A 2-letter `code` tile, the category as
 * the row title with the note as its subtitle (both always shown), and the
 * signed amount tinted by direction (income green, expense red). Rows share one
 * rounded card in the parent; a hairline divider sits above every row except the
 * first (`first` prop), so there is no rule above the first or below the last.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  code,
  signed,
  signedAmount,
  DEFAULT_CURRENCY,
  type Transaction,
} from '../domain';
import { useTheme, metrics, Txt } from '../theme';

interface ListRowProps {
  entry: Transaction;
  symbol?: string;
  /** First row in the card — omit the top divider. */
  first?: boolean;
}

export function ListRow({
  entry,
  symbol = DEFAULT_CURRENCY.symbol,
  first = false,
}: ListRowProps) {
  const { colors } = useTheme();
  const value = signedAmount(entry);

  return (
    <View
      style={[
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair },
      ]}
    >
      <View style={[styles.tile, { backgroundColor: colors.card3 }]}>
        <Txt variant="microLabel" tone="muted">
          {code(entry.category)}
        </Txt>
      </View>

      <View style={styles.body}>
        <Txt variant="listItem" numberOfLines={1}>
          {entry.category}
        </Txt>
        <Txt variant="secondary" tone="muted" numberOfLines={1}>
          {entry.note}
        </Txt>
      </View>

      <Txt variant="inlineAmount" tone={entry.type === 'income' ? 'positive' : 'negative'}>
        {signed(value, symbol)}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});
