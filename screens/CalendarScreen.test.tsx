/**
 * CalendarScreen strip BUDGET column (#50/#66): hidden until any budget is
 * active in the current mode, remaining logic is mode-aware (per-category sum or
 * total), overspent shows as true negative, and the value tracks the displayed
 * month (the swipe-sync contract — the strip re-reads the cursor when the pager
 * commits, so all four columns move in the same render).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Budgets, CalendarView, Transaction } from '../domain';
import { ThemeProvider, palettes } from '../theme';
import { CalendarScreen } from './CalendarScreen';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? 'x',
  timestamp: '2026-07-01T00:00:00.000Z',
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
  budgetMode: 'category' | 'total' = 'category',
  totalBudget: number = 0,
  view: CalendarView = 'numbers',
  onToggleView: () => void = () => {},
) =>
  render(
    <ThemeProvider>
      <CalendarScreen
        entries={entries}
        budgets={budgets}
        budgetMode={budgetMode}
        totalBudget={totalBudget}
        y={2026}
        m={6}
        day={1}
        symbol="¥"
        view={view}
        onToggleView={onToggleView}
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
  it('exposes a working dark-mode icon that toggles its label', () => {
    renderCalendar([], {});
    const toggle = screen.getByLabelText('Use dark mode');
    fireEvent.press(toggle);
    expect(screen.getByLabelText('Use light mode')).toBeTruthy();
  });

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
    const view = renderCalendar(entries, { Food: 30000 });
    expect(screen.getByText('¥20,000')).toBeTruthy();

    view.rerender(
      <ThemeProvider>
        <CalendarScreen
          entries={entries}
          budgets={{ Food: 30000 }}
          budgetMode="category"
          totalBudget={0}
          y={2026}
          m={7}
          day={1}
          symbol="¥"
          view="numbers"
          onToggleView={() => {}}
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

describe('CalendarScreen entry actions', () => {
  it('wires each row swipe Delete action to that entry', () => {
    const onDeleteEntry = jest.fn();
    const item = tx({ id: 'delete-me' });
    render(
      <ThemeProvider>
        <CalendarScreen
          entries={[item]}
          budgets={{}}
          budgetMode="category"
          totalBudget={0}
          y={2026}
          m={6}
          day={1}
          symbol="¥"
          view="numbers"
          onToggleView={() => {}}
          onSelectDay={() => {}}
          onEditEntry={() => {}}
          onDeleteEntry={onDeleteEntry}
          onPrevMonth={() => {}}
          onNextMonth={() => {}}
          onMonthChange={() => {}}
          onSettings={() => {}}
        />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByLabelText('Delete Food'));

    expect(onDeleteEntry).toHaveBeenCalledWith(item);
  });
});

/**
 * Header (Kippu design §2): the month leads at full weight with the year set
 * back in `dim`, a live entry count sits under them, and the view toggle names
 * the variant it switches *to*.
 */
describe('CalendarScreen header', () => {
  it('splits the title so the month and year are separately styled', () => {
    renderCalendar([], {});
    // Reads as one phrase, but the year is its own node so it can recede.
    expect(screen.getByText('July 2026')).toBeTruthy();

    const year = screen.getByText('2026');
    const style = StyleSheet.flatten(year.props.style);
    expect(style.color).toBe(palettes.light.faint);
    expect(style.fontWeight).toBe('400');
  });

  it('sets the entry count a step darker than the year it sits under', () => {
    renderCalendar([], {});
    const year = StyleSheet.flatten(screen.getByText('2026').props.style);
    const count = StyleSheet.flatten(screen.getByText('0 entries this month').props.style);

    expect(year.color).toBe(palettes.light.faint);
    expect(count.color).toBe(palettes.light.dim);
    expect(count.color).not.toBe(year.color);
  });

  it('counts the displayed month, not the whole ledger', () => {
    renderCalendar([tx({ id: 'a' }), tx({ id: 'b' }), tx({ id: 'c', m: 7 })], {});
    expect(screen.getByText('2 entries this month')).toBeTruthy();
  });

  it('uses the singular for a month with one entry, and counts an empty month', () => {
    renderCalendar([tx({ id: 'a' })], {});
    expect(screen.getByText('1 entry this month')).toBeTruthy();
    screen.unmount();

    renderCalendar([], {});
    expect(screen.getByText('0 entries this month')).toBeTruthy();
  });

  it('offers the number view while showing dots, and the dot view while showing numbers', () => {
    renderCalendar([], {}, 'category', 0, 'dots');
    expect(screen.getByLabelText('Show numbers')).toBeTruthy();
    expect(screen.queryByLabelText('Show dots')).toBeNull();
    screen.unmount();

    renderCalendar([], {}, 'category', 0, 'numbers');
    expect(screen.getByLabelText('Show dots')).toBeTruthy();
  });

  it('reports a toggle press without changing the view itself', () => {
    const onToggleView = jest.fn();
    renderCalendar([], {}, 'category', 0, 'dots', onToggleView);

    fireEvent.press(screen.getByLabelText('Show numbers'));

    expect(onToggleView).toHaveBeenCalledTimes(1);
    // Still the caller's view — the parent owns the state.
    expect(screen.getByLabelText('Show numbers')).toBeTruthy();
  });
});
