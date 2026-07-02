/**
 * DayCell — one day in the month grid. Shows the day number (mono) and, when
 * non-zero, that day's signed net in the tiny mono style, tinted green/red. The
 * selected day is a solid green cell with near-black text (the shared selection
 * accent, decision colors). Empty days read as just the number.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { signed } from '../domain';
import { useTheme, metrics, accents, Txt } from '../theme';

interface DayCellProps {
  day: number;
  /** Signed daily net; 0 renders no amount line. */
  net: number;
  selected: boolean;
  onPress: (day: number) => void;
}

export function DayCell({ day, net, selected, onPress }: DayCellProps) {
  const { colors } = useTheme();
  const hasNet = net !== 0;
  const netTone = selected ? 'onPositive' : net > 0 ? 'positive' : 'negative';

  return (
    <Pressable
      onPress={() => onPress(day)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Day ${day}`}
      style={[
        styles.cell,
        { backgroundColor: selected ? accents.positive : colors.card2 },
      ]}
    >
      <Txt variant="calendarDay" tone={selected ? 'onPositive' : 'ink'}>
        {day}
      </Txt>
      {hasNet && (
        <Txt variant="calendarDayTotal" tone={netTone} numberOfLines={1}>
          {/* compact signed net, no currency symbol, to fit the cell */}
          {signed(net, '')}
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
