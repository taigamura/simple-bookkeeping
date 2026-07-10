/**
 * Summary domain tests (slice #5 acceptance criteria): the expense category
 * breakdown (sorting + bar widths scaled to the max) and the in/out split
 * proportions.
 */
import { categoryBreakdown, splitProportions } from './summary';
import type { Transaction } from './types';

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

describe('categoryBreakdown', () => {
  const entries = [
    tx({ id: 'a', type: 'expense', category: 'Food', amount: 300 }),
    tx({ id: 'b', type: 'expense', category: 'Food', amount: 200 }), // Food = 500
    tx({ id: 'c', type: 'expense', category: 'Transport', amount: 250 }),
    tx({ id: 'd', type: 'expense', category: 'Bills', amount: 100 }),
    tx({ id: 'e', type: 'income', category: 'Salary', amount: 9999 }), // ignored
  ];

  it('sums expenses per category, highest-first', () => {
    const bd = categoryBreakdown(entries);
    expect(bd.map((s) => [s.category, s.total])).toEqual([
      ['Food', 500],
      ['Transport', 250],
      ['Bills', 100],
    ]);
  });

  it('scales each bar fraction to the largest category (top = 1)', () => {
    const bd = categoryBreakdown(entries);
    expect(bd[0].fraction).toBe(1); // Food is the max
    expect(bd[1].fraction).toBeCloseTo(250 / 500);
    expect(bd[2].fraction).toBeCloseTo(100 / 500);
  });

  it('ignores income entries entirely', () => {
    const bd = categoryBreakdown(entries);
    expect(bd.some((s) => s.category === 'Salary')).toBe(false);
  });

  it('returns [] for a month with no expenses', () => {
    expect(categoryBreakdown([tx({ type: 'income', amount: 500 })])).toEqual([]);
    expect(categoryBreakdown([])).toEqual([]);
  });
});

describe('categoryBreakdown budget annotation (#51)', () => {
  const entries = [
    tx({ id: 'a', category: 'Food', amount: 12000 }),
    tx({ id: 'b', category: 'Hobby', amount: 3000 }),
  ];

  it('annotates budgeted slices with budget and remaining = budget − spent', () => {
    const [food] = categoryBreakdown(entries, { Food: 30000 });
    expect(food.category).toBe('Food');
    expect(food.budget).toBe(30000);
    expect(food.remaining).toBe(18000);
  });

  it('goes negative when the category is over budget, never clamped', () => {
    const [food] = categoryBreakdown(entries, { Food: 10000 });
    expect(food.remaining).toBe(-2000);
  });

  it('leaves unbudgeted slices without budget fields', () => {
    const bd = categoryBreakdown(entries, { Food: 30000 });
    const hobby = bd.find((s) => s.category === 'Hobby')!;
    expect('budget' in hobby).toBe(false);
    expect('remaining' in hobby).toBe(false);
  });

  it('a budget for a category with no spending this month adds no slice', () => {
    const bd = categoryBreakdown(entries, { Rent: 80000 });
    expect(bd.some((s) => s.category === 'Rent')).toBe(false);
  });

  it('defaults to no annotation when budgets are omitted', () => {
    for (const slice of categoryBreakdown(entries)) {
      expect(slice.budget).toBeUndefined();
      expect(slice.remaining).toBeUndefined();
    }
  });
});

describe('splitProportions', () => {
  it('splits income and expense proportional to their combined flow', () => {
    const s = splitProportions([
      tx({ type: 'income', amount: 750 }),
      tx({ type: 'expense', amount: 250 }),
    ]);
    expect(s.income).toBe(750);
    expect(s.expense).toBe(250);
    expect(s.incomeFraction).toBeCloseTo(0.75);
    expect(s.expenseFraction).toBeCloseTo(0.25);
  });

  it('fractions sum to 1 when there is any flow', () => {
    const s = splitProportions([
      tx({ type: 'income', amount: 400 }),
      tx({ type: 'expense', amount: 100 }),
    ]);
    expect(s.incomeFraction + s.expenseFraction).toBeCloseTo(1);
  });

  it('is all zeros for an empty month (no divide-by-zero)', () => {
    expect(splitProportions([])).toEqual({
      income: 0,
      expense: 0,
      incomeFraction: 0,
      expenseFraction: 0,
    });
  });
});
