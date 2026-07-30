/**
 * ListRow — one entry in the day list. A category emoji tile, the category as
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
  emojiFor,
  signed,
  signedAmount,
  stamp,
  DEFAULT_CURRENCY,
  type Transaction,
} from '../domain';
import { strings } from '../i18n';
import { useTheme, metrics, Txt } from '../theme';

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
  // Entries carried over from before timestamps existed only know their day, so
  // their reconstructed time is marked approximate.
  const timestamp = stamp(entry.timestamp);
  const timestampLabel = entry.timestampInferred ? `~${timestamp}` : timestamp;

  const rowStyle = [
    styles.row,
    !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair },
  ];

  const content = (
    <>
      <View style={[styles.tile, { backgroundColor: colors.card2 }]}>
        {/* Decorative: the category name is already the row title right beside it. */}
        <Txt style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
          {emojiFor(entry.category)}
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

      {/* Amount over timestamp in one right-aligned column. The full
          `YYYY/MM/DD HH:MM` is too wide to share a line with the note — beside
          it, the note was truncating to two or three characters — so the two
          stacked figures balance the category/note pair on the left instead. */}
      <View style={styles.trailing}>
        <Txt
          variant="inlineAmount"
          tone={entry.type === 'income' ? 'positive' : 'ink'}
          numberOfLines={1}
          style={styles.column}
        >
          {signed(value, symbol)}
        </Txt>
        <Txt variant="timestamp" tone="dim" numberOfLines={1} style={styles.column}>
          {timestampLabel}
        </Txt>
      </View>
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
  /** Sized so the tile reads as an icon, not as text in a box. */
  emoji: { fontSize: 17, lineHeight: 22 },
  body: { flex: 1, gap: 2 },
  trailing: { alignItems: 'flex-end', gap: 2 },
  /** One invariant width for both stacked figures, so amounts and timestamps
   *  each line up down the list. Sized for the longest timestamp
   *  (`~YYYY/MM/DD HH:MM` at the mono advance width). */
  column: {
    width: 112,
    textAlign: 'right',
  },
  deleteAction: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
