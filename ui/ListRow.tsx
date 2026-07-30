/**
 * ListRow — one entry in the day list. A 2-letter `code` tile, the category as
 * the row title with the note and creation time beneath it, and the signed
 * amount: income in the accent blue, expense in plain ink so a day of spending
 * stays calm. Rows share one rounded card in the parent; a hairline divider sits
 * above every row except the first (`first` prop), so there is no rule above the
 * first or below the last.
 */
import React, { useRef } from 'react';
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
import { useTheme, metrics, mono, Txt } from '../theme';

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
  const swipeInProgress = useRef(false);
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
      <View style={[styles.tile, { backgroundColor: colors.card2 }]}>
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
          <Txt
            variant="secondary"
            tone="dim"
            numberOfLines={1}
            style={styles.timestamp}
          >
            {timestampLabel}
          </Txt>
        </View>
      </View>

      <Txt
        variant="inlineAmount"
        tone={entry.type === 'income' ? 'positive' : 'ink'}
        numberOfLines={1}
        style={styles.amount}
      >
        {signed(value, symbol)}
      </Txt>
    </>
  );

  const row = onPress ? (
      <Pressable
        onPress={() => {
          if (swipeInProgress.current) return;
          onPress();
        }}
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
      onSwipeableOpenStartDrag={() => {
        swipeInProgress.current = true;
      }}
      onSwipeableCloseStartDrag={() => {
        swipeInProgress.current = true;
      }}
      onSwipeableOpen={() => {
        swipeInProgress.current = false;
      }}
      onSwipeableClose={() => {
        swipeInProgress.current = false;
      }}
      renderRightActions={(_progress, _drag, swipeable) => (
        <Pressable
          onPress={() => {
            swipeable.close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={strings.entry.deleteFromList(entry.category)}
          style={[styles.deleteAction, { backgroundColor: colors.negative }]}
        >
          <Txt variant="listItem" tone="onNegative">
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
  timestamp: {
    width: 72,
    fontFamily: mono.regular,
    textAlign: 'right',
  },
  amount: {
    width: 112,
    textAlign: 'right',
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
