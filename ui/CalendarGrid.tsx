/**
 * CalendarGrid — the 7-column month grid with a weekday header. Renders leading
 * blank cells for the month's starting weekday, then a `DayCell` per day carrying
 * its signed daily net. Selection is owned by the parent (Calendar screen).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  dayNet,
  daysInMonth,
  firstWeekday,
  WEEKDAYS,
  type Transaction,
} from '../domain';
import { useTheme, Txt } from '../theme';
import { DayCell } from './DayCell';

interface CalendarGridProps {
  y: number;
  m: number;
  /** Entries already filtered to (y, m). */
  monthEntries: Transaction[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
}

export function CalendarGrid({
  y,
  m,
  monthEntries,
  selectedDay,
  onSelectDay,
}: CalendarGridProps) {
  const total = daysInMonth(y, m);
  const lead = firstWeekday(y, m);
  const days = Array.from({ length: total }, (_, i) => i + 1);
  const blanks = Array.from({ length: lead }, (_, i) => i);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((wd, i) => (
          <View key={i} style={styles.weekSlot}>
            <Txt variant="microLabel" tone="dim">
              {wd}
            </Txt>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {blanks.map((b) => (
          <View key={`b${b}`} style={styles.slot} />
        ))}
        {days.map((day) => (
          <View key={day} style={styles.slot}>
            <DayCell
              day={day}
              net={dayNet(monthEntries, day)}
              selected={day === selectedDay}
              onPress={onSelectDay}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const COL = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekSlot: { width: COL, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  // Seven columns; each slot is 1/7 and its DayCell stretches to fill it.
  slot: { width: COL, paddingHorizontal: 3 },
});
