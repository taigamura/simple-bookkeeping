/**
 * Monthly budgets (#49). One recurring amount per *expense* category — it
 * applies to every month until changed (no per-specific-month values). The
 * model is a plain map from category name to positive integer amount; a
 * category absent from the map simply has no budget. Income categories never
 * appear here.
 *
 * All operations return a new map (never mutate) and return the input map
 * unchanged when there is nothing to do, matching `categories.ts`.
 */

import { daysInMonth } from './calendar';
import { expense } from './entries';
import type { RecurrenceDate, Transaction, YM } from './types';

/** Category name → recurring monthly budget (positive integer, no minor units). */
export type Budgets = Record<string, number>;

export type TodayAllowanceStatus = 'available' | 'no-budget' | 'overspent';

export interface TodayAllowance {
  /** Explicit state so consumers do not mistake a missing budget for zero. */
  status: TodayAllowanceStatus;
  /** Conservatively rounded amount available per remaining calendar day. */
  amount: number | null;
  /** Configured monthly budget in the selected budget mode. */
  configuredBudget: number;
  /** Expenses dated today or earlier in the target month. */
  spentThroughToday: number;
  /** Number of calendar days from today through the end of the month. */
  remainingDays: number;
}

/**
 * `setBudget(budgets, category, amount)` — store a positive integer budget for
 * the category (rounding fractions). A zero, negative, or non-finite amount
 * clears instead: "no budget" is the absence of an entry, never a 0 value.
 */
export function setBudget(budgets: Budgets, category: string, amount: number): Budgets {
  const rounded = Math.round(amount);
  if (!Number.isFinite(amount) || rounded <= 0) return clearBudget(budgets, category);
  return { ...budgets, [category]: rounded };
}

/** `clearBudget(budgets, category)` — drop the entry; no-op when absent. */
export function clearBudget(budgets: Budgets, category: string): Budgets {
  if (!(category in budgets)) return budgets;
  const next = { ...budgets };
  delete next[category];
  return next;
}

/** Whether any category has a budget set — gates budget display downstream (#50/#51). */
export function hasAnyBudget(budgets: Budgets): boolean {
  return Object.keys(budgets).length > 0;
}

/**
 * `budgetRemaining(budgets, entries)` — the month's remaining budget (#50):
 * Σ(set category budgets) − total expenses over the given (already
 * month-filtered) entries. Every expense counts against the total, including
 * spending in unbudgeted categories; income never enters the math. Goes
 * negative when overspent — never clamped to zero.
 */
export function budgetRemaining(budgets: Budgets, entries: Transaction[]): number {
  const total = Object.values(budgets).reduce((sum, amount) => sum + amount, 0);
  return total - expense(entries);
}

/**
 * `pruneBudgets(budgets, categories)` — drop entries whose category is no
 * longer in the list, so deleting an expense category silently drops its
 * budget. Returns the input map unchanged when nothing is orphaned.
 */
export function pruneBudgets(budgets: Budgets, categories: string[]): Budgets {
  const keep = new Set(categories);
  const orphaned = Object.keys(budgets).filter((c) => !keep.has(c));
  if (orphaned.length === 0) return budgets;
  const next = { ...budgets };
  for (const c of orphaned) delete next[c];
  return next;
}

/**
 * `isBudgetActive(mode, budgets, totalBudget)` — whether any budget is active
 * in the given mode. In category mode, true iff any category has a budget set.
 * In total mode, true iff totalBudget > 0. Gates budget display in Calendar
 * and Summary (#66).
 */
export function isBudgetActive(
  mode: 'category' | 'total',
  budgets: Budgets,
  totalBudget: number,
): boolean {
  return mode === 'total' ? totalBudget > 0 : hasAnyBudget(budgets);
}

/**
 * `getRemainingBudget(mode, budgets, totalBudget, entries)` — the month's
 * remaining budget in the given mode. In category mode, Σ(set category
 * budgets) − total expenses. In total mode, totalBudget − total expenses.
 * Every expense counts, including unbudgeted categories. Income never enters.
 * Goes negative when overspent, never clamped (#66).
 */
export function getRemainingBudget(
  mode: 'category' | 'total',
  budgets: Budgets,
  totalBudget: number,
  entries: Transaction[],
): number {
  const totalExpense = expense(entries);
  if (mode === 'total') {
    return totalBudget - totalExpense;
  }
  // category mode: same as the existing budgetRemaining
  return budgetRemaining(budgets, entries);
}

/**
 * Calculate the current month's "today allowance" payload.
 *
 * Only expenses in the target month dated through `today` count. Income and
 * future-dated entries are deliberately ignored. The divisor includes today,
 * and floor rounding keeps the allowance conservative in integer currencies.
 * Callers should only present this payload when `month` is today's month.
 */
export function getTodayAllowance(
  mode: 'category' | 'total',
  budgets: Budgets,
  totalBudget: number,
  entries: Transaction[],
  month: YM,
  today: RecurrenceDate,
): TodayAllowance {
  const configuredBudget = mode === 'total'
    ? totalBudget
    : Object.values(budgets).reduce((sum, amount) => sum + amount, 0);
  const spentThroughToday = expense(entries.filter((entry) => (
    entry.y === month.y && entry.m === month.m && entry.day <= today.day
  )));
  const remainingDays = Math.max(daysInMonth(month.y, month.m) - today.day + 1, 1);

  if (configuredBudget <= 0) {
    return {
      status: 'no-budget',
      amount: null,
      configuredBudget,
      spentThroughToday,
      remainingDays,
    };
  }

  const remainingBudget = configuredBudget - spentThroughToday;
  if (remainingBudget < 0) {
    return {
      status: 'overspent',
      amount: null,
      configuredBudget,
      spentThroughToday,
      remainingDays,
    };
  }

  return {
    status: 'available',
    amount: Math.floor(remainingBudget / remainingDays),
    configuredBudget,
    spentThroughToday,
    remainingDays,
  };
}
