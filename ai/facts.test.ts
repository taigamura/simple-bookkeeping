/**
 * Fact sheet (ADR-0006): the only numbers the models may cite. Tests read the
 * sheet the way the letter/nudge prompts do: by stable id, display and tone.
 */
import { entriesForMonth, expense, getRemainingBudget, income } from '../domain';
import type { RecurrenceRule, Transaction } from '../domain';
import { DEFAULT_STATE, type AppState } from '../store/schema';
import type { Fact } from './contract';
import { buildFacts } from './facts';

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
  weekendShift: 'off',
  exceptions: [],
  ...over,
});

const state = (over: Partial<AppState>): AppState => ({ ...DEFAULT_STATE, ...over });
const byId = (facts: Fact[]) => Object.fromEntries(facts.map((f) => [f.id, f]));

const TODAY = { y: 2026, m: 9, day: 15 }; // 2026-10-15

describe('buildFacts', () => {
  it('returns [] for an empty month', () => {
    expect(buildFacts(state({}), 2026, 9, TODAY, 'ja')).toEqual([]);
  });

  it('totals, net and entry count, formatted for the currency', () => {
    const s = state({
      entries: [
        tx({ day: 2, amount: 1200, category: 'Food' }),
        tx({ day: 3, amount: 300, category: 'Transport' }),
        tx({ day: 5, type: 'income', amount: 250000, category: 'Salary' }),
      ],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'ja'));
    expect(f['expense-total']).toMatchObject({ value: 1500, display: '¥1,500' });
    expect(f['income-total']).toMatchObject({ value: 250000, display: '¥250,000' });
    expect(f.net).toMatchObject({ value: 248500, display: '+¥248,500', tone: 'positive' });
    expect(f['entry-count']).toMatchObject({ value: 3, display: '3件' });
    const en = byId(buildFacts({ ...s, currency: { symbol: '$', code: 'USD' } }, 2026, 9, TODAY, 'en'));
    expect(en['expense-total'].display).toBe('$1,500');
    expect(en['entry-count'].display).toBe('3 entries');
  });

  it('leaves out income-total when there is no income, and no budget facts without a budget', () => {
    const f = byId(buildFacts(state({ entries: [tx({ day: 2 })] }), 2026, 9, TODAY, 'en'));
    expect(f['income-total']).toBeUndefined();
    expect(f['budget-left']).toBeUndefined();
    expect(f['budget-pace']).toBeUndefined();
  });

  it('counts repeats via projection, matching the Summary totals', () => {
    const s = state({
      entries: [tx({ day: 2, amount: 1000 })],
      recurrenceRules: [rule({ start: { y: 2026, m: 0, day: 25 } })],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'en'));
    const month = entriesForMonth(s, { y: 2026, m: 9 });
    expect(f['expense-total'].value).toBe(expense(month));
    expect(f['expense-total'].value).toBe(81000);
  });

  it('top category and the top-3 category totals', () => {
    const s = state({
      entries: [
        tx({ day: 1, amount: 5000, category: '食費' }),
        tx({ day: 1, amount: 3000, category: '交通' }),
        tx({ day: 2, amount: 2000, category: '日用品' }),
        tx({ day: 2, amount: 1000, category: '趣味' }),
      ],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'ja'));
    expect(f['top-category']).toMatchObject({ display: '食費', value: 5000 });
    expect(f['cat-total:食費'].display).toBe('¥5,000');
    expect(f['cat-total:交通'].display).toBe('¥3,000');
    expect(f['cat-total:日用品'].display).toBe('¥2,000');
    expect(f['cat-total:趣味']).toBeUndefined();
  });

  it('expense-vs-last compares the current month to the same day last month', () => {
    const s = state({
      entries: [
        tx({ m: 8, day: 10, amount: 1000 }),
        tx({ m: 8, day: 20, amount: 9000 }), // after day 15 last month: excluded
        tx({ m: 9, day: 12, amount: 1500 }),
      ],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'en'));
    expect(f['expense-vs-last']).toMatchObject({ value: 50, display: '+50%', tone: 'watch' });
  });

  it('expense-vs-last compares whole months for a past month', () => {
    const s = state({
      entries: [tx({ m: 7, day: 10, amount: 2000 }), tx({ m: 8, day: 28, amount: 1500 })],
    });
    const f = byId(buildFacts(s, 2026, 8, TODAY, 'ja'));
    expect(f['expense-vs-last']).toMatchObject({ value: -25, display: '−25%', tone: 'positive' });
  });

  it('omits expense-vs-last when last month had no spending', () => {
    const f = byId(buildFacts(state({ entries: [tx({ day: 2 })] }), 2026, 9, TODAY, 'en'));
    expect(f['expense-vs-last']).toBeUndefined();
  });

  it('cat-pace names the category whose spending moved most', () => {
    const s = state({
      entries: [
        tx({ m: 8, day: 5, amount: 1000, category: 'Food' }),
        tx({ m: 8, day: 5, amount: 1000, category: 'Fun' }),
        tx({ m: 9, day: 5, amount: 1200, category: 'Food' }),
        tx({ m: 9, day: 5, amount: 4000, category: 'Fun' }),
      ],
    });
    const facts = buildFacts(s, 2026, 9, TODAY, 'en');
    const pace = facts.filter((x) => x.id.startsWith('cat-pace:'));
    expect(pace).toHaveLength(1);
    expect(pace[0]).toMatchObject({ id: 'cat-pace:Fun', value: 300, display: '+300%' });
  });

  it('budget facts in category mode match the Summary remaining budget', () => {
    const s = state({
      budgets: { Food: 20000, Fun: 10000 },
      entries: [tx({ day: 3, amount: 6000, category: 'Food' }), tx({ day: 4, amount: 3000, category: 'Shopping' })],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'ja'));
    const month = entriesForMonth(s, { y: 2026, m: 9 });
    expect(f['budget-left'].value).toBe(getRemainingBudget('category', s.budgets, 0, month));
    expect(f['budget-left']).toMatchObject({ value: 21000, display: '¥21,000', tone: 'positive' });
    // 9000 of 30000 used = 30%, with 15/31 of the month elapsed.
    expect(f['budget-pace']).toMatchObject({ value: 30, display: '30%', tone: 'positive' });
  });

  it('budget facts in total mode; overspending reads as watch, never negative', () => {
    const s = state({
      budgetMode: 'total',
      totalBudget: 5000,
      budgets: { Food: 999999 }, // ignored in total mode
      entries: [tx({ day: 3, amount: 6000 })],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'en'));
    expect(f['budget-left']).toMatchObject({ value: -1000, display: '−¥1,000', tone: 'watch' });
    expect(f['budget-pace']).toMatchObject({ value: 120, tone: 'watch' });
  });

  it('no-spend days count elapsed days only; the streak runs back from today', () => {
    // Spending on Oct 1, 2, 10, 12. Today = Oct 15 → 15 elapsed days, 4 with spend.
    const s = state({
      entries: [2, 1, 10, 12].map((day) => tx({ day })).concat(tx({ day: 25, amount: 50 })),
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'ja'));
    expect(f['no-spend-days']).toMatchObject({ value: 11, display: '11日', tone: 'positive' });
    expect(f['no-spend-streak']).toMatchObject({ value: 3, display: '3日', tone: 'positive' });
    const en = byId(buildFacts(s, 2026, 9, TODAY, 'en'));
    expect(en['no-spend-days'].display).toBe('11 days');
  });

  it('a past month counts every day and has no streak', () => {
    const s = state({ entries: [tx({ m: 8, day: 1 })] });
    const f = byId(buildFacts(s, 2026, 8, TODAY, 'en'));
    expect(f['no-spend-days'].value).toBe(29);
    expect(f['no-spend-streak']).toBeUndefined();
  });

  it('the streak continues across the month boundary', () => {
    const s = state({ entries: [tx({ m: 8, day: 28 }), tx({ m: 9, day: 20 })] });
    const f = byId(buildFacts(s, 2026, 9, { y: 2026, m: 9, day: 3 }, 'en'));
    // Sep 29, 30, Oct 1, 2, 3.
    expect(f['no-spend-streak'].value).toBe(5);
  });

  it('biggest day carries the amount and a separate date fact', () => {
    const s = state({
      entries: [tx({ day: 4, amount: 500 }), tx({ day: 9, amount: 3000 }), tx({ day: 9, amount: 1000 })],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'ja'));
    expect(f['biggest-day']).toMatchObject({ value: 4000, display: '¥4,000' });
    expect(f['biggest-day-date']).toMatchObject({ value: 9, display: '10月9日' });
    expect(byId(buildFacts(s, 2026, 9, TODAY, 'en'))['biggest-day-date'].display).toBe('Oct 9');
  });

  it('new-repeat flags a repeat rule created this month', () => {
    const s = state({
      entries: [tx({ day: 2 })],
      recurrenceRules: [
        rule({ id: 'old' }),
        rule({
          id: 'netflix',
          timestamp: '2026-10-08T03:00:00.000Z',
          start: { y: 2026, m: 9, day: 8 },
          amount: 1490,
          category: 'Fun',
          note: 'Netflix',
        }),
      ],
    });
    const f = byId(buildFacts(s, 2026, 9, TODAY, 'en'));
    expect(f['new-repeat']).toMatchObject({ value: 1490, display: '¥1,490' });
    expect(f['new-repeat'].label).toContain('Netflix');
    expect(byId(buildFacts(s, 2026, 8, TODAY, 'en'))['new-repeat']).toBeUndefined();
  });

  it('every fact has a label, a display and a non-shaming tone; ids are unique', () => {
    const s = state({
      budgets: { Food: 1000 },
      entries: [tx({ m: 8, day: 3, amount: 100 }), tx({ day: 3, amount: 5000 }), tx({ day: 4, type: 'income', amount: 10 })],
    });
    const facts = buildFacts(s, 2026, 9, TODAY, 'ja');
    expect(facts.length).toBeGreaterThanOrEqual(10);
    expect(new Set(facts.map((x) => x.id)).size).toBe(facts.length);
    for (const x of facts) {
      expect(x.label.length).toBeGreaterThan(0);
      expect(x.display.length).toBeGreaterThan(0);
      expect(['positive', 'neutral', 'watch']).toContain(x.tone);
      expect(x.display).not.toMatch(/[—―]/);
    }
    // sanity against the domain helpers
    const month = entriesForMonth(s, { y: 2026, m: 9 });
    expect(byId(facts).net.value).toBe(income(month) - expense(month));
    expect(byId(facts).net.tone).toBe('watch');
  });
});
