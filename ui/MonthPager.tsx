/**
 * MonthPager — the calendar grid's month-by-month pager (#48).
 *
 * All the paging mechanics (window growth, settle-on-momentum-end commit,
 * external cursor follow, the pre-measurement static fallback) live in
 * `PeriodPager`, which this and the Summary screen's category list share. What
 * remains here is the calendar-specific part: a page is a `CalendarGrid`, a
 * step is one month, and only the committed month's grid takes day taps while
 * its neighbours merely preview the carried-over selection.
 */
import React from 'react';

import {
  clampDay,
  monthEntries,
  shiftMonth,
  type CalendarView,
  type RecurrenceDate,
  type Transaction,
  type YM,
} from '../domain';
import { CalendarGrid } from './CalendarGrid';
import { PeriodPager, buildPeriodWindow, pageIndex } from './PeriodPager';

export { pageIndex };

/** Build a month window spanning `radius` months either side of `center`. */
export function buildWindow(center: YM, radius: number): YM[] {
  return buildPeriodWindow(center, radius, shiftMonth);
}

interface MonthPagerProps {
  /** The full ledger; each month grid filters it via `monthEntries`. */
  entries: Transaction[];
  y: number;
  m: number;
  selectedDay: number;
  today?: RecurrenceDate;
  /** Day-cell variant, passed straight through to every month's grid. */
  view?: CalendarView;
  /** Landing-pulse target day and nonce (pure pass-through — see `DayCell`).
   *  Applied only to the committed month's grid, same rule as `onSelectDay`. */
  pulseDay?: number;
  pulseNonce?: number;
  onSelectDay: (day: number) => void;
  /** Commit the absolute month the pager settled on. */
  onMonthChange: (ym: YM) => void;
}

const monthKey = (ym: YM) => `${ym.y}-${ym.m}`;

export function MonthPager({
  entries,
  y,
  m,
  selectedDay,
  today,
  view,
  pulseDay,
  pulseNonce,
  onSelectDay,
  onMonthChange,
}: MonthPagerProps) {
  return (
    <PeriodPager
      testID="month-pager"
      cursor={{ y, m }}
      shift={shiftMonth}
      keyOf={monthKey}
      onCursorChange={onMonthChange}
      renderPage={(month, isCursor) => (
        <CalendarGrid
          y={month.y}
          m={month.m}
          monthEntries={monthEntries(entries, month)}
          // Neighbours preview the carried-over selection, clamped in-range;
          // only the committed month's grid takes day taps.
          selectedDay={clampDay(selectedDay, month.y, month.m)}
          today={today}
          view={view}
          pulseDay={isCursor ? pulseDay : undefined}
          pulseNonce={isCursor ? pulseNonce : undefined}
          onSelectDay={isCursor ? onSelectDay : () => {}}
        />
      )}
    />
  );
}
