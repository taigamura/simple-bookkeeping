/**
 * ListRow — one entry in the day list. A 2-letter `code` tile, the category as
 * the row title with the note and creation time beneath it, and the signed
 * amount tinted by direction (income green, expense red). Rows share one
 * rounded card in the parent; a hairline divider sits above every row except the
 * first (`first` prop), so there is no rule above the first or below the last.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import {
  code,
  signed,
  signedAmount,
  DEFAULT_CURRENCY,
  type Transaction,
} from '../domain';
import { strings } from '../i18n';
import { useTheme, metrics, mono, accents, Txt } from '../theme';

interface ListRowProps {
  entry: Transaction;
  symbol?: string;
  /** First row in the card — omit the top divider. */
  first?: boolean;
  /** When set, the row is pressable (tap to edit the entry, #43). */
  onPress?: () => void;
  /** When set, swiping left reveals a destructive action. */
  onDelete?: () => void;
}

export function ListRow({
  entry,
  symbol = DEFAULT_CURRENCY.symbol,
  first = false,
  onPress,
  onDelete,
}: ListRowProps) {
  const { colors } = useTheme();
  const value = signedAmount(entry);
  const timestamp = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(entry.timestamp));
  const timestampLabel = entry.timestampInferred ? `~${timestamp}` : timestamp;

  const rowStyle = [
    styles.row,
    !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair },
  ];

  const content = (
    <>
      <View style={[styles.tile, { backgroundColor: colors.card3 }]}>
        <Txt variant="microLabel" tone="muted">
          {code(entry.category)}
        </Txt>
      </View>

      <View style={styles.body}>
        <Txt variant="listItem" numberOfLines={1}>
          {entry.category}
        </Txt>
        <View style={styles.meta}>
          <Txt variant="secondary" tone="muted" numberOfLines={1} style={styles.note}>
            {entry.note}
          </Txt>
          <Txt variant="secondary" tone="dim" style={styles.timestamp}>
            {timestampLabel}
          </Txt>
        </View>
      </View>

      <Txt variant="inlineAmount" tone={entry.type === 'income' ? 'positive' : 'negative'}>
        {signed(value, symbol)}
      </Txt>
    </>
  );

  const row = onPress ? (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={strings.entry.editEntry(entry.category)}
        style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.6 }]}
      >
        {content}
      </Pressable>
    ) : (
      <View style={rowStyle}>{content}</View>
    );

  if (!onDelete) return row;

  return (
    <Swipeable
      testID={`swipeable-${entry.id}`}
      overshootRight={false}
      rightThreshold={40}
      renderRightActions={(_progress, _drag, swipeable) => (
        <Pressable
          onPress={() => {
            swipeable.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={strings.entry.deleteFromList(entry.category)}
          style={styles.deleteAction}
        >
          <Txt variant="listItem" style={{ color: accents.onPositive }}>
            {strings.common.delete}
          </Txt>
        </Pressable>
      )}
    >
      {row}
    </Swipeable>
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
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { flex: 1 },
  timestamp: { fontFamily: mono.regular },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: accents.negative,
  },
});
