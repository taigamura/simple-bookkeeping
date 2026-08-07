/**
 * SummaryScreen budget display (#51/#66): the net card's budget-left line
 * (hidden until any budget is active in the current mode, mode-aware remaining
 * calculation, same as Calendar strip) and the category bars' spent / budget
 * annotation (red when over budget, in total mode all bars show spend only),
 * plus the Monthly/Annual granularity toggle: which period the hero figure and
 * the category bars aggregate, and the deliberate suppression of every budget
 * affordance in annual mode.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Budgets, SummaryGranularity, Transaction } from '../domain';
import { strings } from '../i18n';
import { ThemeProvider, palettes } from '../theme';

const light = palettes.light;
import { SummaryScreen } from './SummaryScreen';

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

const renderSummary = (
  entries: Transaction[],
  budgets: Budgets,
  budgetMode: 'category' | 'total' = 'category',
  totalBudget: number = 0,
  granularity: SummaryGranularity = 'monthly',
  onChangeGranularity: (g: SummaryGranularity) => void = () => {},
) =>
  render(
    <ThemeProvider>
      <SummaryScreen
        entries={entries}
        budgets={budgets}
        budgetMode={budgetMode}
        totalBudget={totalBudget}
        y={2026}
        m={6}
        symbol="¥"
        granularity={granularity}
        onChangeGranularity={onChangeGranularity}
        onPeriodChange={() => {}}
        onSettings={() => {}}
      />
    </ThemeProvider>,
  );

describe('SummaryScreen net card budget-left line (#51)', () => {
  it('exposes the dark-mode icon from the Summary tab too', () => {
    renderSummary([], {});
    expect(screen.getByLabelText(strings.nav.useDarkMode)).toBeTruthy();
  });

  it('is absent when no budgets are set', () => {
    renderSummary([tx({ amount: 5000 })], {});
    expect(screen.getByText('Net this month')).toBeTruthy();
    expect(screen.queryByText('Budget left')).toBeNull();
  });

  it('shows remaining = Σ budgets − month expenses, agreeing with the Calendar strip', () => {
    // Same fixture as the CalendarScreen #50 test: 110,000 − 15,000 = 95,000.
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 12000 }),
      tx({ id: 'b', category: 'Hobby', amount: 3000 }), // unbudgeted, still counts
      tx({ id: 'c', type: 'income', category: 'Salary', amount: 250000 }), // ignored
    ];
    renderSummary(entries, { Food: 30000, Rent: 80000 });
    expect(screen.getByText('Budget left')).toBeTruthy();
    expect(screen.getByText('¥95,000')).toBeTruthy();
  });

  it('shows a true negative remaining when overspent, never clamped', () => {
    renderSummary([tx({ amount: 45000 })], { Food: 30000 });
    expect(screen.getByText('−¥15,000')).toBeTruthy();
  });
});

describe('SummaryScreen category bar budget annotation (#51)', () => {
  const entries = [
    tx({ id: 'a', category: 'Food', amount: 12000 }),
    tx({ id: 'b', category: 'Hobby', amount: 3000 }),
  ];

  it('shows spent / budget on budgeted bars and leaves unbudgeted bars unchanged', () => {
    renderSummary(entries, { Food: 30000 });
    expect(screen.getByText('¥12,000 / ¥30,000')).toBeTruthy();
    expect(screen.getByText('¥3,000')).toBeTruthy(); // Hobby, plain amount
  });

  it('renders the amount red when the category is over budget', () => {
    renderSummary([tx({ amount: 45000 })], { Food: 30000 });
    const amount = StyleSheet.flatten(screen.getByText('¥45,000 / ¥30,000').props.style);
    expect(amount.color).toBe(light.negative);
  });

  it('keeps the amount un-red while within budget', () => {
    renderSummary(entries, { Food: 30000 });
    const amount = StyleSheet.flatten(screen.getByText('¥12,000 / ¥30,000').props.style);
    expect(amount.color).not.toBe(light.negative);
  });
});

describe('SummaryScreen Monthly/Annual granularity', () => {
  // July and November of 2026, plus one row in 2025 that annual must exclude.
  const entries = [
    tx({ id: 'a', category: 'Food', amount: 12000 }),
    tx({ id: 'b', m: 10, category: 'Food', amount: 8000 }),
    tx({ id: 'c', y: 2025, m: 10, category: 'Food', amount: 500000 }),
  ];

  it('aggregates only the cursor month when monthly', () => {
    renderSummary(entries, {});
    expect(screen.getByText('Net this month')).toBeTruthy();
    expect(screen.getByText('July 2026')).toBeTruthy();
    expect(screen.getByText('−¥12,000')).toBeTruthy();
  });

  it('aggregates the whole calendar year when annual, excluding other years', () => {
    renderSummary(entries, {}, 'category', 0, 'annual');
    expect(screen.getByText('Net this year')).toBeTruthy();
    expect(screen.getByText('2026')).toBeTruthy();
    // 12,000 + 8,000 — the 2025 row is a different period, not a wider one.
    expect(screen.getByText('−¥20,000')).toBeTruthy();
  });

  it('reports the picked granularity through onChangeGranularity', () => {
    const onChangeGranularity = jest.fn();
    renderSummary(entries, {}, 'category', 0, 'monthly', onChangeGranularity);
    fireEvent.press(screen.getByLabelText(strings.summary.annual));
    expect(onChangeGranularity).toHaveBeenCalledWith('annual');
  });

  it('hides the budget-left line in annual mode even with budgets set', () => {
    renderSummary(entries, { Food: 30000 }, 'category', 0, 'annual');
    expect(screen.queryByText('Budget left')).toBeNull();
  });

  it('drops the spent / budget annotation from category bars in annual mode', () => {
    // A second category so the Food bar's total is distinguishable from the
    // hero's Out legend, which would otherwise be the same figure.
    const mixed = [...entries, tx({ id: 'd', m: 2, category: 'Hobby', amount: 5000 })];
    renderSummary(mixed, { Food: 30000 }, 'category', 0, 'annual');
    expect(screen.queryByText('¥20,000 / ¥30,000')).toBeNull();
    expect(screen.getByText('¥20,000')).toBeTruthy();
    expect(screen.getByText('¥25,000')).toBeTruthy(); // the Out legend
  });

  it('still shows the budget affordances in monthly mode', () => {
    renderSummary(entries, { Food: 30000 });
    expect(screen.getByText('Budget left')).toBeTruthy();
    expect(screen.getByText('¥12,000 / ¥30,000')).toBeTruthy();
  });
});
