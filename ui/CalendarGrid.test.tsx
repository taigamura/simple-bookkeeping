/**
 * CalendarGrid structural test (#40): the month must group into Sunday-first
 * weeks of exactly seven columns so the 7th cell can never wrap onto its own
 * row on device. Covers the pure `monthWeeks` grouping and the rendered rows.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { daysInMonth, firstWeekday } from '../domain';
import { ThemeProvider } from '../theme';
import { CalendarGrid, monthWeeks } from './CalendarGrid';

describe('monthWeeks', () => {
  it('groups every month into rows of exactly 7 columns', () => {
    // Sweep a full year across a leap February and 31/30-day months.
    for (let m = 0; m < 12; m++) {
      const weeks = monthWeeks(2024, m);
      expect(weeks.every((week) => week.length === 7)).toBe(true);
    }
  });

  it('lays days out Sunday-first with leading blanks for the starting weekday', () => {
    // July 2026 starts on a Wednesday (index 3), so the first Sunday column is
    // blank and day 1 sits in the Wednesday column.
    expect(firstWeekday(2026, 6)).toBe(3);
    const weeks = monthWeeks(2026, 6);
    expect(weeks[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    // Day 5 (a Sunday) opens the second week in column 0.
    expect(weeks[1][0]).toBe(5);
  });

  it('keeps every day of the month exactly once', () => {
    const total = daysInMonth(2026, 6);
    const days = monthWeeks(2026, 6)
      .flat()
      .filter((d): d is number => d != null);
    expect(days).toEqual(Array.from({ length: total }, (_, i) => i + 1));
  });
});

describe('CalendarGrid', () => {
  it('renders each week as a row of 7 columns', () => {
    render(
      <ThemeProvider>
        <CalendarGrid
          y={2026}
          m={6}
          monthEntries={[]}
          selectedDay={1}
          onSelectDay={() => {}}
        />
      </ThemeProvider>,
    );
    const rows = screen.getAllByTestId('calendar-week');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(React.Children.count(row.props.children)).toBe(7);
    }
  });
});
