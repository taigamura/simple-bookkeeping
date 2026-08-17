/**
 * Fictitious demo ledger for App Store screenshots (issue #79 publication
 * package, Part 5). Loaded on demand from an explicit Settings action — never
 * seeded at first launch (decision 8: a fresh ledger is empty) and never a
 * hidden debug mode. The data is non-sensitive and invented; the amounts and
 * dates mirror the screenshot matrix so captures match the listing plan.
 *
 * Pure: returns plain domain values. The store patch is assembled by the caller
 * so this module never depends on the persistence layer.
 */
import type { Budgets } from './budgets';
import type { Transaction, YM } from './types';

/** Month the sample ledger lives in: June 2026 (m is 0-based). */
export const SAMPLE_MONTH: YM = { y: 2026, m: 5 };

/** A day that carries entries, so the calendar opens on a populated cell. */
export const SAMPLE_SELECTED_DAY = 8;

// Stable ids/timestamps keep the sample deterministic (no random uid/clock), so
// screenshots and tests are reproducible run to run.
function tx(
  id: number,
  day: number,
  type: Transaction['type'],
  category: string,
  amount: number,
  note = '',
): Transaction {
  const mm = String(SAMPLE_MONTH.m + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    id: `sample-${id}`,
    timestamp: `${SAMPLE_MONTH.y}-${mm}-${dd}T12:00:00.000Z`,
    y: SAMPLE_MONTH.y,
    m: SAMPLE_MONTH.m,
    day,
    type,
    amount,
    category,
    note,
    repeat: 'never',
  };
}

/**
 * The demo ledger as a set of plain domain values. The caller spreads these
 * into the store update so the whole ledger (entries, categories, budgets)
 * becomes the fictitious sample in one atomic change.
 */
export interface SampleLedger {
  entries: Transaction[];
  expCats: string[];
  incCats: string[];
  budgets: Budgets;
  budgetMode: 'category';
  totalBudget: number;
  recurrenceRules: [];
}

export function sampleLedger(): SampleLedger {
  return {
    entries: [
      tx(1, 5, 'expense', 'Food', 2500),
      tx(2, 8, 'income', 'Salary', 350000),
      tx(3, 12, 'expense', 'Rent', 80000),
      tx(4, 15, 'expense', 'Transport', 3000),
      tx(5, 18, 'expense', 'Entertainment', 5000),
      tx(6, 22, 'expense', 'Food', 1800),
      tx(7, 25, 'income', 'Bonus', 8000),
    ],
    // Rent leads the expense categories so the sample's biggest line is visible;
    // the rest keep the app's defaults so editing the sample still feels normal.
    expCats: ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment'],
    incCats: ['Salary', 'Bonus', 'Gift', 'Other'],
    budgets: { Food: 15000, Rent: 80000, Transport: 10000, Entertainment: 15000 },
    budgetMode: 'category',
    // A total is set too, so a capture in Total budget mode also reads well.
    totalBudget: 150000,
    recurrenceRules: [],
  };
}
