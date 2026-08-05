/**
 * CalendarGrid — the 7-column month grid with a weekday header. Renders leading
 * blank cells for the month's starting weekday, then a `DayCell` per day carrying
 * its signed daily net. Selection is owned by the parent (Calendar screen).
 *
 * The month is grouped into explicit Sunday-first week rows of exactly seven
 * `flex: 1` cells (#40). The earlier layout laid every cell out in one
 * `flexWrap` row at `100/7 %` width; on device those seven percentage widths
 * could round past 100% and wrap the 7th cell onto a new line, collapsing the
 * week to 6 columns (Sunday looked skipped). Fixed-count rows guarantee 7.
 *
 * `pulseDay`/`pulseNonce` are pure pass-through to the one `DayCell` whose
 * `day` matches `pulseDay` — the landing-pulse ring a just-saved entry gets is
 * owned entirely by `DayCell`; this component only routes the nonce to the
 * right cell.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  daysInMonth,
  firstWeekday,
  signedAmount,
  WEEKDAYS,
  type CalendarView,
  type RecurrenceDate,
  type Transaction,
} from '../domain';
import { Txt } from '../theme';
import { DayCell } from './DayCell';

interface CalendarGridProps {
  y: number;
  m: number;
  /** Entries already filtered to (y, m). */
  monthEntries: Transaction[];
  selectedDay: number;
  today?: RecurrenceDate;
  /** Day-cell variant; defaults to the design's dot variant. */
  view?: CalendarView;
  /** The day, within this month, that should play the landing pulse. */
  pulseDay?: number;
  /** Nonce for that pulse — see `DayCell`'s `pulse` prop. */
  pulseNonce?: number;
  onSelectDay: (day: number) => void;
}

/**
 * Group month (y, m) into Sunday-first weeks of exactly seven cells: leading
 * `null`s for the starting weekday, one entry per day, then trailing `null`s so
 * the final week is also seven wide (keeps the `flex: 1` columns aligned). Pure
 * grouping over the existing date-math helpers — no date logic changes here.
 */
export function monthWeeks(y: number, m: number): (number | null)[][] {
  const lead = firstWeekday(y, m);
  const total = daysInMonth(y, m);
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function CalendarGrid({
  y,
  m,
  monthEntries,
  selectedDay,
  today,
  view,
  pulseDay,
  pulseNonce,
  onSelectDay,
}: CalendarGridProps) {
  const weeks = monthWeeks(y, m);
  // Build the daily totals once. Calling dayNet() from every cell filters the
  // whole month once per day, which becomes noticeable for a busy ledger.
  const dailyNets = new Map<number, number>();
  for (const entry of monthEntries) {
    dailyNets.set(entry.day, (dailyNets.get(entry.day) ?? 0) + signedAmount(entry));
  }

  return (
    <View>
      <View style={styles.headerRow}>
        {WEEKDAYS.map((wd, i) => (
          <View key={i} style={styles.headSlot}>
            <Txt variant="microLabel" tone="dim">
              {wd}
            </Txt>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow} testID="calendar-week">
            {week.map((day, di) => (
              <View key={di} style={styles.slot}>
                {day != null && (
                  <DayCell
                    day={day}
                    net={dailyNets.get(day) ?? 0}
                    selected={day === selectedDay}
                    today={today?.y === y && today.m === m && today.day === day}
                    view={view}
                    pulse={day === pulseDay ? pulseNonce : undefined}
                    onPress={onSelectDay}
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A calendar row: seven equal flex columns, so exactly 7 fit per row on every
  // platform (no subpixel wrap). Shared by the weekday header and the day rows.
  weekRow: { flexDirection: 'row' },
  headerRow: { flexDirection: 'row', marginBottom: 6 },
  grid: { rowGap: 6 },
  headSlot: { flex: 1, alignItems: 'center' },
  // Each column is 1/7 of the row; its DayCell stretches to fill the padding box.
  slot: { flex: 1, paddingHorizontal: 3 },
});
