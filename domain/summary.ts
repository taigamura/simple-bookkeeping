/**
 * Summary aggregation (build-decisions "Aggregation"): the category breakdown
 * and in/out split proportions the Summary screen renders. Pure over a
 * `Transaction[]` (already month-filtered by the caller).
 */
import type { Budgets } from './budgets';
import { expense, income } from './entries';
import type { Transaction } from './types';

/** One ranked expense category: its total and bar width scaled to the max. */
export interface CategorySlice {
  category: string;
  total: number;
  /** total / largest-category-total, in [0, 1]; the top bar is always 1. */
  fraction: number;
  /** The category's monthly budget (#51); absent when none is set. */
  budget?: number;
  /** budget − total, negative when overspent — never clamped (#51). */
  remaining?: number;
}

/**
 * Expense totals per category, highest-first, each with a `fraction` scaled to
 * the largest category (for bar widths). Income is ignored; an all-income or
 * empty month yields `[]`. Slices for budgeted categories carry `budget` and
 * `remaining` (#51); unbudgeted slices omit both fields entirely.
 */
export function categoryBreakdown(entries: Transaction[], budgets: Budgets = {}): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const t of entries) {
    if (t.type !== 'expense') continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }

  const ranked = [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const max = ranked.length > 0 ? ranked[0].total : 0;
  return ranked.map((slice) => {
    const budget = budgets[slice.category];
    return {
      ...slice,
      fraction: max > 0 ? slice.total / max : 0,
      ...(budget !== undefined ? { budget, remaining: budget - slice.total } : {}),
    };
  });
}

/** In/out totals plus each side's share of `income + expense` (0 when empty). */
export interface Split {
  income: number;
  expense: number;
  incomeFraction: number;
  expenseFraction: number;
}

/**
 * The in/out split: income and expense magnitudes and their proportions of the
 * combined flow. When there is no flow at all, both fractions are 0.
 */
export function splitProportions(entries: Transaction[]): Split {
  const inc = income(entries);
  const exp = expense(entries);
  const total = inc + exp;
  return {
    income: inc,
    expense: exp,
    incomeFraction: total > 0 ? inc / total : 0,
    expenseFraction: total > 0 ? exp / total : 0,
  };
}
