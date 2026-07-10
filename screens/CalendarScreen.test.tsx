/**
 * CalendarScreen strip BUDGET column (#50): hidden until any budget is set,
 * remaining = Σ budgets − month expenses, true negative when overspent, and
 * the value tracks the displayed month (the swipe-sync contract — the strip
 * re-reads the cursor when the pager commits, so all four columns move in the
 * same render).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import type { Budgets, Transaction } from '../domain';
import { ThemeProvider } from '../theme';
import { CalendarScreen } from './CalendarScreen';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? 'x',
  y: 2026,
  m: 6,
  day: 1,
  type: 'expense',
  amount: 100,
  category: 'Food',
  note: 'Food',
  repeat: 'never',
  ...over,
});

const renderCalendar = (
  entries: Transaction[],
  budgets: Budgets,
  ym: { y: number; m: number } = { y: 2026, m: 6 },
) =>
  render(
    <ThemeProvider>
      <CalendarScreen
        entries={entries}
        budgets={budgets}
        y={ym.y}
        m={ym.m}
        day={1}
        symbol="¥"
        onSelectDay={() => {}}
        onEditEntry={() => {}}
        onPrevMonth={() => {}}
        onNextMonth={() => {}}
        onMonthChange={() => {}}
        onSettings={() => {}}
      />
    </ThemeProvider>,
  );

describe('CalendarScreen strip BUDGET column (#50)', () => {
  it('stays a three-column strip when no budgets are set', () => {
    renderCalendar([tx({ amount: 5000 })], {});
    expect(screen.getByText('In')).toBeTruthy();
    expect(screen.getByText('Out')).toBeTruthy();
    expect(screen.getByText('Net')).toBeTruthy();
    expect(screen.queryByText('Budget')).toBeNull();
  });

  it('shows remaining = total budgets − month expenses once any budget is set', () => {
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 12000 }),
      tx({ id: 'b', category: 'Hobby', amount: 3000 }), // unbudgeted, still counts
      tx({ id: 'c', type: 'income', category: 'Salary', amount: 250000 }), // ignored
    ];
    renderCalendar(entries, { Food: 30000, Rent: 80000 });
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.getByText('¥95,000')).toBeTruthy();
  });

  it('shows a true negative remaining when overspent, never clamped', () => {
    renderCalendar([tx({ amount: 45000 })], { Food: 30000 });
    expect(screen.getByText('−¥15,000')).toBeTruthy();
  });

  it('re-derives the remaining from the displayed month when the cursor moves', () => {
    const entries = [
      tx({ id: 'jul', m: 6, amount: 10000 }),
      tx({ id: 'aug', m: 7, amount: 25000 }),
    ];
    const view = renderCalendar(entries, { Food: 30000 }, { y: 2026, m: 6 });
    expect(screen.getByText('¥20,000')).toBeTruthy();

    view.rerender(
      <ThemeProvider>
        <CalendarScreen
          entries={entries}
          budgets={{ Food: 30000 }}
          y={2026}
          m={7}
          day={1}
          symbol="¥"
          onSelectDay={() => {}}
          onEditEntry={() => {}}
          onPrevMonth={() => {}}
          onNextMonth={() => {}}
          onMonthChange={() => {}}
          onSettings={() => {}}
        />
      </ThemeProvider>,
    );
    expect(screen.getByText('¥5,000')).toBeTruthy();
    expect(screen.queryByText('¥20,000')).toBeNull();
  });
});
