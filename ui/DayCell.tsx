/**
 * DayCell — one day in the month grid. Shows the day number (mono) and, when
 * non-zero, that day's signed net in the tiny mono style: income in the accent
 * blue, expense in plain ink so a month of spending reads as one calm surface
 * rather than a wall of red. Non-selected cells sit on the card fill; the
 * selected day is a solid accent tile. Empty days read as just the number.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { signed } from '../domain';
import { strings } from '../i18n';
import { useTheme, metrics, Txt } from '../theme';

interface DayCellProps {
  day: number;
  /** Signed daily net; 0 renders no amount line. */
  net: number;
  selected: boolean;
  /** The real current date, independently outlined when it is not selected. */
  today?: boolean;
  onPress: (day: number) => void;
}

export function DayCell({ day, net, selected, today = false, onPress }: DayCellProps) {
  const { colors } = useTheme();
  const hasNet = net !== 0;
  // Income is the only tinted total; expense stays ink (see file header).
  const netTone = net > 0 ? 'positive' : 'ink';
  const netText = signed(net, '');

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
      {hasNet && (
        <Txt
          variant="calendarDayTotal"
          tone={selected ? 'onPositive' : netTone}
          style={selected ? styles.selectedTotal : undefined}
          numberOfLines={1}
        >
          {/* compact signed net, no currency symbol, to fit the cell */}
          {netText}
        </Txt>
      )}
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
