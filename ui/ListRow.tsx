/**
 * ListRow — one entry in the day list. A category emoji tile, the category as
 * the row title with the note and creation time beneath it, and the signed
 * amount: income in the accent blue, expense in plain ink so a day of spending
 * stays calm. Rows share one rounded card in the parent; a hairline divider sits
 * above every row except the first (`first` prop), so there is no rule above the
 * first or below the last.
 *
 * ## Motion
 *
 * Rows enter and leave rather than appear and vanish: a new entry fades/slides
 * in (`FadeInDown`), a deleted one fades/slides out (`FadeOut`), and every row
 * carries `LinearTransition` so the rows above and below a deletion reflow to
 * close the gap smoothly instead of jumping. All three are list-local motion
 * (`durations.quick`, matching a chip fill or a segment slide, not a
 * screen-scale crossfade), and all three are inert whenever `useMotion()`
 * reports motion off — an `Animated.View` with no `entering`/`exiting`/`layout`
 * behaves exactly like a plain `View`, so the disabled path does not need a
 * separate render tree the way `DayCell`'s does.
 *
 * Every builder also carries `.reduceMotion(ReduceMotion.Never)`. Gating the
 * whole prop on `useMotion().enabled` is necessary but not sufficient: each
 * builder has its own default (`ReduceMotion.System`) that re-checks the
 * OS-level flag independently, even after `enabled` has already resolved to
 * `true` — including when it resolved to `true` *because* the user picked
 * Kaji's "Full" preference specifically to override that flag. Without the
 * explicit override here, that override does nothing. See
 * `theme/motion.ts`'s `withAppTiming`/`withAppSpring` for the identical bug
 * in every non-layout animation in this app.
 *
 * The tap-to-edit press now goes through `PressScale` (`surface`, matching
 * other wide tap targets) instead of a bare `Pressable`, so a tap reads as
 * physical contact rather than only the existing opacity dip. The opacity dip
 * is kept alongside it deliberately: press-in on a bright row is a color
 * response finger-speed can't be, and the two together read as "this pressed"
 * rather than fighting each other.
 */
import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import {
  emojiFor,
  signed,
  signedAmount,
  stamp,
  DEFAULT_CURRENCY,
  type Transaction,
} from '../domain';
import { strings } from '../i18n';
import { useTheme, metrics, durations, easings, useMotion, ReduceMotion, Txt } from '../theme';
import { PressScale } from './PressScale';

interface ListRowProps {
  entry: Transaction;
  symbol?: string;
  /** First row in the card — omit the top divider. */
  first?: boolean;
  /** When set, the row is pressable (tap to edit the entry, #43). */
  onPress?: () => void;
  /** When set, swiping left reveals a destructive action. */
  onDelete?: () => void;
  /** Registers the open row so its action can be dismissed by the parent. */
  onSwipeableOpen?: (swipeable: Swipeable) => void;
}

export function ListRow({
  entry,
  symbol = DEFAULT_CURRENCY.symbol,
  first = false,
  onPress,
  onDelete,
  onSwipeableOpen,
}: ListRowProps) {
  const { colors } = useTheme();
  const { enabled } = useMotion();
  const swipeInProgress = useRef(false);
  const swipeableRef = useRef<Swipeable | null>(null);
  const value = signedAmount(entry);
  // Entries carried over from before timestamps existed only know their day, so
  // their reconstructed time is marked approximate.
  const timestamp = stamp(entry.timestamp);
  const timestampLabel = entry.timestampInferred ? `~${timestamp}` : timestamp;

  const rowStyle = [
    styles.row,
    { backgroundColor: colors.card2 },
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
      <PressScale
        scale="surface"
        onPress={() => {
          if (swipeInProgress.current) return;
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={strings.entry.editEntry(entry.category)}
        style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.6 }]}
      >
        {content}
      </PressScale>
    ) : (
      <View style={rowStyle}>{content}</View>
    );

  // This surface is deliberately inside Swipeable's translated child tree.
  // The card must travel with the item, not remain as a background layer.
  const rowSurface = (
    <View style={[styles.rowSurface, { backgroundColor: colors.card2 }]}>
      {row}
    </View>
  );

  const wrapped = onDelete ? (
    <Swipeable
      ref={swipeableRef}
      testID={`swipeable-${entry.id}`}
      containerStyle={styles.swipeable}
      childrenContainerStyle={styles.swipeableRow}
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
        if (swipeableRef.current) onSwipeableOpen?.(swipeableRef.current);
      }}
      onSwipeableClose={() => {
        swipeInProgress.current = false;
      }}
      renderRightActions={(_progress, _drag, swipeable) => {
        swipeableRef.current = swipeable;
        return (
        <Pressable
          onPress={() => {
            // Keep the destructive affordance visible while the confirmation
            // is up; the calendar excludes this action zone from dismissal.
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={strings.entry.deleteFromList(entry.category)}
          style={({ pressed }) => [
            styles.deleteAction,
            { backgroundColor: colors.negative, opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <Feather name="trash-2" size={16} color={colors.onNegative} />
          <Txt variant="microLabel" tone="onNegative">
            {strings.common.delete}
          </Txt>
        </Pressable>
        );
      }}
    >
      {rowSurface}
    </Swipeable>
  ) : (
    rowSurface
  );

  return (
    <Animated.View
      entering={
        enabled
          ? FadeInDown.duration(durations.quick)
              .easing(easings.standard)
              .reduceMotion(ReduceMotion.Never)
          : undefined
      }
      exiting={
        enabled
          ? FadeOutLeft.duration(durations.base)
              .easing(easings.exit)
              .reduceMotion(ReduceMotion.Never)
          : undefined
      }
      layout={
        enabled
          ? LinearTransition.duration(durations.quick).reduceMotion(ReduceMotion.Never)
          : undefined
      }
    >
      {wrapped}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: metrics.cardRadius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowSurface: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: metrics.cardRadius,
    overflow: 'hidden',
  },
  // Keep the action behind an opaque, full-width row. Without this, the
  // transparent row lets the trailing amount column remain visible over the
  // revealed delete control on narrow iPhones.
  swipeable: {
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  swipeableRow: {
    width: '100%',
    alignSelf: 'stretch',
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
  body: { flex: 1, minWidth: 0, gap: 2 },
  trailing: { alignItems: 'flex-end', flexShrink: 0, gap: 2 },
  /** One invariant width for both stacked figures, so amounts and timestamps
   *  each line up down the list. Sized for the longest timestamp
   *  (`~YYYY/MM/DD HH:MM` at the mono advance width). */
  column: {
    width: 112,
    textAlign: 'right',
  },
  deleteAction: {
    width: 72,
    marginVertical: 6,
    // Swipeable measures the action including this left inset, so the row
    // travels far enough to expose a deliberate gap before the control.
    marginLeft: 6,
    borderRadius: 12,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
