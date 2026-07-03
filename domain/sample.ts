/**
 * Demo sample data (slice #8, decision 8). `sampleEntries()` returns 15
 * July-2026 transactions — a realistic mix of income and expense across the
 * default categories — for the Settings "Load sample data" action. Ids are
 * stable (`sample-N`) so re-loading replaces rather than duplicates.
 *
 * Lives only in July 2026 (`y:2026, m:6`); every other month stays empty.
 */
import type { Transaction } from './types';

const Y = 2026;
const M = 6; // July (0-based)

type Seed = Omit<Transaction, 'id' | 'y' | 'm' | 'note'> & { note?: string };

const SEEDS: Seed[] = [
  { day: 1, type: 'income', amount: 320000, category: 'Salary' },
  { day: 1, type: 'expense', amount: 1200, category: 'Food', note: 'Lunch' },
  { day: 2, type: 'expense', amount: 480, category: 'Transport' },
  { day: 3, type: 'expense', amount: 8600, category: 'Shopping' },
  { day: 5, type: 'expense', amount: 12000, category: 'Bills', note: 'Electricity' },
  { day: 7, type: 'expense', amount: 2200, category: 'Food' },
  { day: 9, type: 'income', amount: 15000, category: 'Bonus' },
  { day: 11, type: 'expense', amount: 3400, category: 'Entertainment' },
  { day: 13, type: 'expense', amount: 640, category: 'Transport' },
  { day: 15, type: 'expense', amount: 5200, category: 'Health' },
  { day: 18, type: 'expense', amount: 1800, category: 'Food', note: 'Dinner' },
  { day: 20, type: 'income', amount: 5000, category: 'Gift' },
  { day: 22, type: 'expense', amount: 9800, category: 'Shopping' },
  { day: 25, type: 'expense', amount: 1500, category: 'Entertainment' },
  { day: 28, type: 'expense', amount: 760, category: 'Food' },
];

/** The 15 demo transactions, freshly built each call (stable ids). */
export function sampleEntries(): Transaction[] {
  return SEEDS.map((seed, i) => ({
    id: `sample-${i + 1}`,
    y: Y,
    m: M,
    day: seed.day,
    type: seed.type,
    amount: seed.amount,
    category: seed.category,
    note: seed.note ?? seed.category,
    repeat: 'never',
  }));
}
