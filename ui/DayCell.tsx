/**
 * DayCell — one day in the month grid. Shows the day number (mono) and, when
 * non-zero, that day's signed net in the tiny mono style, tinted green/red.
 * Non-selected cells are transparent — only the selected day is a solid green
 * tile with a near-black number, and its total renders in translucent near-black
 * (the shared selection accent, decision colors). Empty days read as just the
 * number.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { signed } from '../domain';
import { strings } from '../i18n';
import { metrics, accents, Txt } from '../theme';

/** Selected-day total: translucent near-black over the green tile (design §1). */
const SELECTED_TOTAL = 'rgba(11,14,18,.7)';

interface DayCellProps {
  day: number;
  /** Signed daily net; 0 renders no amount line. */
  net: number;
  selected: boolean;
  onPress: (day: number) => void;
}

export function DayCell({ day, net, selected, onPress }: DayCellProps) {
  const hasNet = net !== 0;
  const netTone = net > 0 ? 'positive' : 'negative';
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
        { backgroundColor: selected ? accents.positive : 'transparent' },
      ]}
    >
      <Txt variant="calendarDay" tone={selected ? 'onPositive' : 'ink'}>
        {day}
      </Txt>
      {hasNet && (
        <Txt
          variant="calendarDayTotal"
          tone={selected ? 'onPositive' : netTone}
          style={selected ? { color: SELECTED_TOTAL } : undefined}
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
});
