/**
 * SummaryScreen budget display (#51/#66): the net card's budget-left line
 * (hidden until any budget is active in the current mode, mode-aware remaining
 * calculation, same as Calendar strip) and the category bars' spent / budget
 * annotation (red when over budget, in total mode all bars show spend only).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import type { Budgets, Transaction } from '../domain';
import { ThemeProvider, accents } from '../theme';
import { SummaryScreen } from './SummaryScreen';

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

const renderSummary = (
  entries: Transaction[],
  budgets: Budgets,
  budgetMode: 'category' | 'total' = 'category',
  totalBudget: number = 0,
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
        onSettings={() => {}}
      />
    </ThemeProvider>,
  );

describe('SummaryScreen net card budget-left line (#51)', () => {
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
    expect(amount.color).toBe(accents.negative);
  });

  it('keeps the amount un-red while within budget', () => {
    renderSummary(entries, { Food: 30000 });
    const amount = StyleSheet.flatten(screen.getByText('¥12,000 / ¥30,000').props.style);
    expect(amount.color).not.toBe(accents.negative);
  });
});
