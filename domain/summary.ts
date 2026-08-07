/**
 * Summary aggregation (build-decisions "Aggregation"): the category breakdown
 * and in/out split proportions the Summary screen renders. Pure over a
 * `Transaction[]` (already month-filtered by the caller).
 */
import type { Budgets } from './budgets';
import { MONTH_NAMES, shiftMonth } from './calendar';
import { expense, income, monthEntries } from './entries';
import type { Transaction, YM } from './types';

/**
 * How wide a window the Summary screen aggregates over (#swipe/toggle work).
 * `annual` is the calendar year Jan–Dec, not a trailing twelve months: it is
 * the window people already hold budgets, taxes and "what did last year cost"
 * in, and it makes a period a single unambiguous label ("2026") that a pager
 * can step through one page at a time.
 *
 * Everything below is expressed as (cursor `YM` + granularity) rather than as a
 * separate period type. The app has exactly one nav cursor, shared with the
 * Calendar tab, and in `annual` mode the cursor's *month* is deliberately
 * carried along untouched even though nothing reads it — that is what lets a
 * user flip Annual → Monthly and land back on the month they left, and what
 * keeps the Calendar tab where they left it.
 */
export type SummaryGranularity = 'monthly' | 'annual';

export const SUMMARY_GRANULARITIES: readonly SummaryGranularity[] = [
  'monthly',
  'annual',
] as const;

export const isSummaryGranularity = (value: unknown): value is SummaryGranularity =>
  value === 'monthly' || value === 'annual';

/** The entries falling inside the period the cursor and granularity describe. */
export function periodEntries(
  all: Transaction[],
  ym: YM,
  granularity: SummaryGranularity,
): Transaction[] {
  return granularity === 'annual'
    ? all.filter((entry) => entry.y === ym.y)
    : monthEntries(all, ym);
}

/**
 * Move the cursor by `delta` whole periods — a month in `monthly`, a year in
 * `annual`. The annual case shifts the year and leaves `m` alone; see the
 * `SummaryGranularity` note on why the month is preserved rather than reset.
 */
export function shiftPeriod(
  ym: YM,
  delta: number,
  granularity: SummaryGranularity,
): YM {
  return granularity === 'annual' ? { y: ym.y + delta, m: ym.m } : shiftMonth(ym, delta);
}

/** Every month a period covers — one in `monthly`, twelve in `annual`. */
export function periodMonths(ym: YM, granularity: SummaryGranularity): YM[] {
  if (granularity === 'monthly') return [{ y: ym.y, m: ym.m }];
  return Array.from({ length: 12 }, (_, m) => ({ y: ym.y, m }));
}

/** The period's subtitle: "August 2026" monthly, "2026" annually. */
export function periodLabel(ym: YM, granularity: SummaryGranularity): string {
  return granularity === 'annual' ? String(ym.y) : `${MONTH_NAMES[ym.m]} ${ym.y}`;
}

/** Stable identity for a period, for pager keys and same-period comparisons. */
export function periodKey(ym: YM, granularity: SummaryGranularity): string {
  return granularity === 'annual' ? `${ym.y}` : `${ym.y}-${ym.m}`;
}

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
 * empty month yields `[]`. In category mode, slices for budgeted categories
 * carry `budget` and `remaining` (#51); unbudgeted slices omit both. In total
 * mode, no per-category budgets are shown (#66).
 */
export function categoryBreakdown(
  entries: Transaction[],
  budgets: Budgets = {},
  budgetMode: 'category' | 'total' = 'category',
): CategorySlice[] {
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
    // In total mode, never show per-category budgets — all rows render spend only.
    const budget = budgetMode === 'category' ? budgets[slice.category] : undefined;
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
