/**
 * DayCell — one day in the month grid, in either of the design's two variants.
 *
 * `dots` (the default) marks an active day with a single dot whose color and
 * size carry the day's shape: income is the accent blue at full strength,
 * expense is ink held back, and a heavy spending day grows the dot. It reads as
 * a density map of the month and, unlike a number, cannot truncate at seven
 * columns of phone width.
 *
 * `numbers` prints the signed net instead, in the tiny mono style: income in
 * the accent blue, expense in plain ink so a month of spending reads as one
 * calm surface rather than a wall of red.
 *
 * Both variants announce the same net to screen readers, so the choice is
 * purely visual. Non-selected cells sit on the card fill; the selected day is a
 * solid accent tile. Empty days read as just the number.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { signed, type CalendarView } from '../domain';
import { strings } from '../i18n';
import { useTheme, metrics, Txt } from '../theme';

/**
 * Expense magnitude at or above which the dot steps up a size. One fixed
 * threshold rather than a scale relative to the month: a heavy day should look
 * heavy on its own terms, not merely heavier than its neighbours. Currency is
 * symbol-swap only (no FX), so this is a single number in whatever unit the
 * ledger is kept.
 */
export const HEAVY_DAY = 5000;

interface DayCellProps {
  day: number;
  /** Signed daily net; 0 renders no amount line. */
  net: number;
  selected: boolean;
  /** The real current date, independently outlined when it is not selected. */
  today?: boolean;
  /** Which variant to render; defaults to the design's dot variant. */
  view?: CalendarView;
  onPress: (day: number) => void;
}

export function DayCell({
  day,
  net,
  selected,
  today = false,
  view = 'dots',
  onPress,
}: DayCellProps) {
  const { colors } = useTheme();
  const hasNet = net !== 0;
  // Income is the only tinted total; expense stays ink (see file header).
  const income = net > 0;
  const netTone = income ? 'positive' : 'ink';
  const netText = signed(net, '');
  const heavy = !income && Math.abs(net) >= HEAVY_DAY;

  // On the accent tile the dot flips to the on-accent color; otherwise income
  // keeps the accent at full strength and expense is a held-back ink mark.
  const dotSize = heavy ? metrics.dayDotLarge : metrics.dayDot;
  const dotColor = selected ? colors.onPositive : income ? colors.positive : colors.ink;
  const dotOpacity = selected ? 0.85 : income ? 1 : heavy ? 0.65 : 0.3;

  return (
    <Pressable
      onPress={() => onPress(day)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={strings.calendar.dayAccessibilityLabel(day)}
      accessibilityValue={
        hasNet ? { text: strings.calendar.dayNetAccessibilityValue(netText) } : undefined
      }
      style={[
        styles.cell,
        { backgroundColor: selected ? colors.positive : colors.card },
        today && !selected && { borderWidth: 1.5, borderColor: colors.positive },
      ]}
    >
      <Txt variant="calendarDay" tone={selected ? 'onPositive' : 'ink'}>
        {day}
      </Txt>
      {hasNet &&
        (view === 'dots' ? (
          <View
            testID={`day-dot-${day}`}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: metrics.pill,
              backgroundColor: dotColor,
              opacity: dotOpacity,
            }}
          />
        ) : (
          <Txt
            variant="calendarDayTotal"
            tone={selected ? 'onPositive' : netTone}
            style={selected ? styles.selectedTotal : undefined}
            numberOfLines={1}
          >
            {/* compact signed net, no currency symbol, to fit the cell */}
            {netText}
          </Txt>
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    height: metrics.dayCellHeight,
    borderRadius: metrics.dayCellRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  /** Slightly recessive against the accent tile so the day number leads. */
  selectedTotal: { opacity: 0.75 },
});
