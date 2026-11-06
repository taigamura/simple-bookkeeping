import {
  categoryBreakdown,
  entriesForMonth,
  getRemainingBudget,
  isBudgetActive,
  shiftMonth,
  splitProportions,
} from '../domain';
import type { RecurrenceRule, Transaction } from '../domain';
import { DEFAULT_STATE, type AppState } from '../store/schema';
import type { InboxEntry } from './contract';
import { buildSiriSnapshot } from './snapshot';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? `t${n++}`,
  timestamp: '2026-10-01T03:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 100,
  category: 'Food',
  note: '',
  repeat: 'never',
  ...over,
});

const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  id: over.id ?? `r${n++}`,
  timestamp: '2026-01-01T03:00:00.000Z',
  start: { y: 2026, m: 0, day: 25 },
  anchorDay: over.start?.day ?? 25,
  type: 'expense',
  amount: 80000,
  category: 'Bills',
  note: 'Rent',
  repeat: 'monthly',
  weekendShift: 'after',
  exceptions: [],
  ...over,
});

const TODAY = { y: 2026, m: 9, day: 15 };
const NOW = new Date('2026-10-15T01:00:00.000Z');

const ledger: AppState = {
  ...DEFAULT_STATE,
  budgets: { Food: 30000, Bills: 90000 },
  entries: [
    tx({ id: 'a', day: 3, amount: 1200, category: 'Food', note: 'スタバ' }),
    tx({ id: 'b', day: 3, amount: 5000, category: 'Shopping' }),
    tx({ id: 'c', m: 8, day: 30, amount: 700 }),
    tx({ id: 'old', y: 2024, m: 0, day: 5, amount: 1 }), // outside the window: kept as an entry
  ],
  recurrenceRules: [
    rule({ id: 'rent', start: { y: 2024, m: 0, day: 25 } }),
    rule({ id: 'pay', type: 'income', amount: 300000, category: 'Salary', note: '', start: { y: 2025, m: 3, day: 10 } }),
  ],
};

const ymKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;

describe('buildSiriSnapshot', () => {
  const snap = buildSiriSnapshot(ledger, TODAY, 'ja', [], NOW);

  it('carries the header fields', () => {
    expect(snap).toMatchObject({
      version: 1,
      generatedAt: '2026-10-15T01:00:00.000Z',
      locale: 'ja',
      currency: { symbol: '¥', code: 'JPY' },
      today: '2026-10-15',
      expCats: ledger.expCats,
      incCats: ledger.incCats,
    });
  });

  it('has one months entry for every month within ±12 of today', () => {
    const keys = Object.keys(snap.months).sort();
    expect(keys).toHaveLength(25);
    expect(keys[0]).toBe('2025-10');
    expect(keys[24]).toBe('2027-10');
  });

  it('month totals equal the Summary/Calendar domain maths for a ledger with repeats and a budget', () => {
    for (let off = -12; off <= 12; off += 1) {
      const ym = shiftMonth({ y: 2026, m: 9 }, off);
      const month = entriesForMonth(ledger, ym);
      const split = splitProportions(month);
      const t = snap.months[ymKey(ym.y, ym.m)];
      expect(t.income).toBe(split.income);
      expect(t.expense).toBe(split.expense);
      expect(t.net).toBe(split.income - split.expense);
      expect(t.byCategory).toEqual(
        Object.fromEntries(categoryBreakdown(month).map((s) => [s.category, s.total])),
      );
      expect(isBudgetActive(ledger.budgetMode, ledger.budgets, ledger.totalBudget)).toBe(true);
      expect(t.budget).toBe(120000);
      expect(t.budgetLeft).toBe(getRemainingBudget('category', ledger.budgets, 0, month));
    }
  });

  it('includes concrete entries and projected repeat occurrences, sorted by date', () => {
    const dates = snap.entries.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
    expect(snap.entries[0]).toMatchObject({ id: 'old', date: '2024-01-05', repeat: false });
    expect(snap.entries.find((e) => e.id === 'a')).toEqual({
      id: 'a',
      date: '2026-10-03',
      type: 'expense',
      amount: 1200,
      category: 'Food',
      note: 'スタバ',
      repeat: false,
    });
    const rents = snap.entries.filter((e) => e.id.startsWith('rent@'));
    expect(rents).toHaveLength(25);
    expect(rents.every((e) => e.repeat)).toBe(true);
    // 2026-10-25 is a Sunday; weekendShift 'after' moves it to Monday the 26th.
    expect(rents.find((e) => e.date.startsWith('2026-10'))!.date).toBe('2026-10-26');
  });

  it('noSpendDays counts elapsed days only', () => {
    // Oct 2026: expenses on the 3rd only up to the 15th (rent is the 26th).
    expect(snap.months['2026-10'].noSpendDays).toBe(14);
    // Sep 2026 is complete: 30 days, spend on the 25th (Fri) and 30th.
    expect(snap.months['2026-09'].noSpendDays).toBe(28);
    expect(snap.months['2026-11'].noSpendDays).toBe(0);
  });

  it('a ledger without a budget reports null budget fields', () => {
    const s = buildSiriSnapshot({ ...ledger, budgets: {} }, TODAY, 'en', [], NOW);
    expect(s.months['2026-10']).toMatchObject({ budget: null, budgetLeft: null });
  });

  it('total budget mode uses the total budget', () => {
    const s = buildSiriSnapshot({ ...ledger, budgetMode: 'total', totalBudget: 100000 }, TODAY, 'en', [], NOW);
    const month = entriesForMonth(ledger, { y: 2026, m: 9 });
    expect(s.months['2026-10'].budget).toBe(100000);
    expect(s.months['2026-10'].budgetLeft).toBe(getRemainingBudget('total', {}, 100000, month));
  });

  it('includes not-yet-merged inbox entries, flagged, and counts them in the totals', () => {
    const inbox: InboxEntry[] = [
      { id: 'u1', createdAt: '2026-10-15T00:00:00Z', date: '2026-10-14', type: 'expense', amount: 850, category: 'Food', note: 'ランチ' },
      { id: 'bad', createdAt: '2026-10-15T00:00:00Z', date: 'nope', type: 'expense', amount: 1, category: 'Food', note: '' },
    ];
    const s = buildSiriSnapshot(ledger, TODAY, 'ja', inbox, NOW);
    expect(s.entries.find((e) => e.id === 'siri-u1')).toEqual({
      id: 'siri-u1',
      date: '2026-10-14',
      type: 'expense',
      amount: 850,
      category: 'Food',
      note: 'ランチ',
      repeat: false,
      inbox: true,
    });
    expect(s.entries.some((e) => e.id === 'siri-bad')).toBe(false);
    expect(s.months['2026-10'].expense).toBe(snap.months['2026-10'].expense + 850);
    expect(s.months['2026-10'].byCategory.Food).toBe(snap.months['2026-10'].byCategory.Food + 850);
    expect(s.months['2026-10'].noSpendDays).toBe(13);
  });

  it('does not double count an inbox entry already merged into the ledger', () => {
    const merged = { ...ledger, entries: [...ledger.entries, tx({ id: 'siri-u1', day: 14, amount: 850 })] };
    const inbox: InboxEntry[] = [
      { id: 'u1', createdAt: '2026-10-15T00:00:00Z', date: '2026-10-14', type: 'expense', amount: 850, category: 'Food', note: '' },
    ];
    const s = buildSiriSnapshot(merged, TODAY, 'ja', inbox, NOW);
    expect(s.entries.filter((e) => e.id === 'siri-u1')).toHaveLength(1);
    expect(s.entries.find((e) => e.id === 'siri-u1')!.inbox).toBeUndefined();
  });
});
