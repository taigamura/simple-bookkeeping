/**
 * Siri snapshot builder (ADR-0006). JS is the only place that does the maths:
 * every month total here comes from the same domain helpers the Summary and
 * Calendar screens use, so Siri never disagrees with the app.
 */
import {
  categoryBreakdown,
  daysInMonth,
  entriesForMonth,
  expense,
  getRemainingBudget,
  income,
  isBudgetActive,
  shiftMonth,
  type Transaction,
  type YM,
} from '../domain';
import type { AppState } from '../store/schema';
import type { InboxEntry, Locale, MonthTotals, SiriSnapshot, SnapshotEntry, YMD } from './contract';
import { inboxToTransaction } from './inbox';

/** Months either side of today the snapshot projects repeats over. */
export const SNAPSHOT_WINDOW = 12;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for a ledger date (0-based m). */
export const isoDate = (d: { y: number; m: number; day: number }): string =>
  `${d.y}-${pad2(d.m + 1)}-${pad2(d.day)}`;

/** 'YYYY-MM' month key (1-based month). */
export const monthKey = (ym: YM): string => `${ym.y}-${pad2(ym.m + 1)}`;

export function toSnapshotEntry(t: Transaction, inbox = false): SnapshotEntry {
  return {
    id: t.id,
    date: isoDate(t),
    type: t.type,
    amount: t.amount,
    category: t.category,
    note: t.note,
    repeat: t.occurrence !== undefined,
    ...(inbox ? { inbox: true as const } : {}),
  };
}

/** The month's budget amount in the active mode, or null when none is set. */
export function budgetAmount(state: AppState): number | null {
  if (!isBudgetActive(state.budgetMode, state.budgets, state.totalBudget)) return null;
  return state.budgetMode === 'total'
    ? state.totalBudget
    : Object.values(state.budgets).reduce((s, a) => s + a, 0);
}

/** Days of (y, m) that have passed as of `today` (today included). */
export function elapsedDays(ym: YM, today: YMD): number {
  if (ym.y < today.y || (ym.y === today.y && ym.m < today.m)) return daysInMonth(ym.y, ym.m);
  if (ym.y === today.y && ym.m === today.m) return today.day;
  return 0;
}

/** Elapsed days in the month with no expense. */
export function noSpendDays(month: Transaction[], ym: YM, today: YMD): number {
  const elapsed = elapsedDays(ym, today);
  const spent = new Set(month.filter((t) => t.type === 'expense' && t.day <= elapsed).map((t) => t.day));
  return elapsed - spent.size;
}

export function monthTotals(state: AppState, month: Transaction[], ym: YM, today: YMD): MonthTotals {
  const inc = income(month);
  const exp = expense(month);
  const budget = budgetAmount(state);
  return {
    income: inc,
    expense: exp,
    net: inc - exp,
    byCategory: Object.fromEntries(categoryBreakdown(month).map((s) => [s.category, s.total])),
    budget,
    budgetLeft:
      budget === null
        ? null
        : getRemainingBudget(state.budgetMode, state.budgets, state.totalBudget, month),
    noSpendDays: noSpendDays(month, ym, today),
  };
}

export function buildSiriSnapshot(
  state: AppState,
  today: YMD,
  locale: Locale,
  inbox: InboxEntry[],
  now: Date,
): SiriSnapshot {
  const ledgerIds = new Set(state.entries.map((e) => e.id));
  const pending: Transaction[] = [];
  for (const item of inbox) {
    const tx = inboxToTransaction(item);
    if (tx && !ledgerIds.has(tx.id) && !pending.some((p) => p.id === tx.id)) pending.push(tx);
  }
  const pendingIds = new Set(pending.map((p) => p.id));

  const ledger = { entries: [...state.entries, ...pending], recurrenceRules: state.recurrenceRules };
  const ruleOnly = { entries: [], recurrenceRules: state.recurrenceRules };
  const months: Record<string, MonthTotals> = {};
  const projected: Transaction[] = [];
  for (let off = -SNAPSHOT_WINDOW; off <= SNAPSHOT_WINDOW; off += 1) {
    const ym = shiftMonth({ y: today.y, m: today.m }, off);
    months[monthKey(ym)] = monthTotals(state, entriesForMonth(ledger, ym), ym, today);
    projected.push(...entriesForMonth(ruleOnly, ym));
  }

  const entries = [
    ...state.entries.map((t) => toSnapshotEntry(t)),
    ...projected.map((t) => toSnapshotEntry(t)),
    ...pending.map((t) => toSnapshotEntry(t, pendingIds.has(t.id))),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));

  return {
    version: 1,
    generatedAt: now.toISOString(),
    locale,
    currency: { symbol: state.currency.symbol, code: state.currency.code },
    today: isoDate(today),
    expCats: state.expCats,
    incCats: state.incCats,
    entries,
    months,
  };
}
