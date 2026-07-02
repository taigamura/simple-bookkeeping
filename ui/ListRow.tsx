/**
 * ListRow — one entry in the day list. A 2-letter `code` tile, the note (which
 * falls back to the category) with the category as a subtitle when they differ,
 * and the signed amount tinted by direction (income green, expense red).
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
}

export function ListRow({ entry, symbol = DEFAULT_CURRENCY.symbol }: ListRowProps) {
  const { colors } = useTheme();
  const value = signedAmount(entry);
  const showCategory = entry.note !== entry.category;

  return (
    <View style={[styles.row, { borderBottomColor: colors.hair }]}>
      <View style={[styles.tile, { backgroundColor: colors.card3 }]}>
        <Txt variant="microLabel" tone="muted">
          {code(entry.category)}
        </Txt>
      </View>

      <View style={styles.body}>
        <Txt variant="listItem" numberOfLines={1}>
          {entry.note}
        </Txt>
        {showCategory && (
          <Txt variant="secondary" tone="dim" numberOfLines={1}>
            {entry.category}
          </Txt>
        )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
