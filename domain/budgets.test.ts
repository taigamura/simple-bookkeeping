/**
 * Budgets domain tests (#49/#50/#66 acceptance criteria): the pure set/clear
 * transforms, the any-budget-set predicate, pruning on category deletion, the
 * month's remaining-budget math, and mode-aware active/remaining helpers.
 */
import {
  setBudget,
  clearBudget,
  hasAnyBudget,
  budgetRemaining,
  pruneBudgets,
  isBudgetActive,
  getRemainingBudget,
  getTodayAllowance,
  type Budgets,
} from './budgets';
import type { Transaction } from './types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? 'x',
  timestamp: '2026-07-01T00:00:00.000Z',
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

describe('setBudget', () => {
  it('stores a positive amount for the category', () => {
    expect(setBudget({}, 'Food', 30000)).toEqual({ Food: 30000 });
  });

  it('replaces an existing amount', () => {
    expect(setBudget({ Food: 30000 }, 'Food', 25000)).toEqual({ Food: 25000 });
  });

  it('keeps other categories untouched and never mutates the input', () => {
    const before: Budgets = { Rent: 80000 };
    const after = setBudget(before, 'Food', 30000);
    expect(after).toEqual({ Rent: 80000, Food: 30000 });
    expect(before).toEqual({ Rent: 80000 });
  });

  it('rounds fractional amounts to integers', () => {
    expect(setBudget({}, 'Food', 100.6)).toEqual({ Food: 101 });
  });

  it('clears instead of storing zero, negative, or non-finite amounts', () => {
    expect(setBudget({ Food: 30000 }, 'Food', 0)).toEqual({});
    expect(setBudget({ Food: 30000 }, 'Food', -5)).toEqual({});
    expect(setBudget({ Food: 30000 }, 'Food', NaN)).toEqual({});
  });
});

describe('clearBudget', () => {
  it('drops the category entry', () => {
    expect(clearBudget({ Food: 30000, Rent: 80000 }, 'Food')).toEqual({ Rent: 80000 });
  });

  it('returns the input map unchanged when the category has no budget', () => {
    const budgets: Budgets = { Rent: 80000 };
    expect(clearBudget(budgets, 'Food')).toBe(budgets);
  });

  it('never mutates the input', () => {
    const before: Budgets = { Food: 30000 };
    clearBudget(before, 'Food');
    expect(before).toEqual({ Food: 30000 });
  });
});

describe('hasAnyBudget', () => {
  it('is false for the empty map and true once any budget is set', () => {
    expect(hasAnyBudget({})).toBe(false);
    expect(hasAnyBudget({ Food: 30000 })).toBe(true);
  });
});

describe('budgetRemaining', () => {
  it('is total budgets minus total expenses', () => {
    const budgets: Budgets = { Food: 30000, Rent: 80000 };
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 12000 }),
      tx({ id: 'b', category: 'Rent', amount: 80000 }),
    ];
    expect(budgetRemaining(budgets, entries)).toBe(18000);
  });

  it('counts spending in unbudgeted categories against the total', () => {
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 10000 }),
      tx({ id: 'b', category: 'Hobby', amount: 5000 }), // no budget set
    ];
    expect(budgetRemaining({ Food: 30000 }, entries)).toBe(15000);
  });

  it('never lets income enter the math', () => {
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 10000 }),
      tx({ id: 'b', type: 'income', category: 'Salary', amount: 999999 }),
    ];
    expect(budgetRemaining({ Food: 30000 }, entries)).toBe(20000);
  });

  it('goes negative when overspent — never clamped to zero', () => {
    expect(budgetRemaining({ Food: 30000 }, [tx({ amount: 45000 })])).toBe(-15000);
  });

  it('is the full budget total for a month with no entries', () => {
    expect(budgetRemaining({ Food: 30000, Rent: 80000 }, [])).toBe(110000);
  });
});

describe('getTodayAllowance (#94)', () => {
  const today = { y: 2026, m: 1, day: 27 };
  const month = { y: 2026, m: 1 };

  it('divides remaining configured budget by remaining days, including today', () => {
    const result = getTodayAllowance('category', { Food: 1000 }, 0, [
      tx({ id: 'past', y: 2026, m: 1, day: 26, amount: 100 }),
      tx({ id: 'today', y: 2026, m: 1, day: 27, amount: 200 }),
      tx({ id: 'future', y: 2026, m: 1, day: 28, amount: 500 }),
      tx({ id: 'income', y: 2026, m: 1, day: 27, type: 'income', amount: 9999 }),
    ], month, today);

    expect(result).toMatchObject({
      status: 'available',
      amount: 350,
      configuredBudget: 1000,
      spentThroughToday: 300,
      remainingDays: 2,
    });
  });

  it('uses the final day as a one-day divisor in leap years and floors fractions', () => {
    expect(getTodayAllowance(
      'total', {}, 1001,
      [tx({ y: 2028, m: 1, day: 29, amount: 1 })],
      { y: 2028, m: 1 },
      { y: 2028, m: 1, day: 29 },
    )).toMatchObject({ amount: 1000, remainingDays: 1 });
  });

  it('makes no-budget and overspent states explicit', () => {
    expect(getTodayAllowance('category', {}, 0, [], month, today).status).toBe('no-budget');
    expect(getTodayAllowance(
      'total', {}, 100,
      [tx({ y: 2026, m: 1, day: 27, amount: 101 })],
      month,
      today,
    )).toMatchObject({ status: 'overspent', amount: null, spentThroughToday: 101 });
  });

  it('keeps entries from other months out of the current-month calculation', () => {
    expect(getTodayAllowance(
      'total', {}, 1000,
      [tx({ y: 2025, m: 1, day: 27, amount: 900 })],
      month,
      today,
    ).spentThroughToday).toBe(0);
  });
});

describe('pruneBudgets', () => {
  it('drops entries whose category was deleted', () => {
    expect(pruneBudgets({ Food: 30000, Rent: 80000 }, ['Food'])).toEqual({ Food: 30000 });
  });

  it('returns the input map unchanged when every entry still has its category', () => {
    const budgets: Budgets = { Food: 30000 };
    expect(pruneBudgets(budgets, ['Food', 'Rent'])).toBe(budgets);
  });

  it('empties out entirely when no budgeted category survives', () => {
    expect(pruneBudgets({ Food: 30000 }, ['Rent'])).toEqual({});
  });
});

describe('isBudgetActive', () => {
  it('in category mode: true iff any category has a budget', () => {
    expect(isBudgetActive('category', {}, 0)).toBe(false);
    expect(isBudgetActive('category', { Food: 30000 }, 0)).toBe(true);
    expect(isBudgetActive('category', { Food: 30000 }, 100000)).toBe(true); // total is ignored in category mode
  });

  it('in total mode: true iff totalBudget > 0', () => {
    expect(isBudgetActive('total', {}, 0)).toBe(false);
    expect(isBudgetActive('total', {}, 100000)).toBe(true);
    expect(isBudgetActive('total', { Food: 30000 }, 0)).toBe(false); // category budgets are ignored in total mode
    expect(isBudgetActive('total', { Food: 30000 }, 100000)).toBe(true);
  });
});

describe('getRemainingBudget', () => {
  it('in category mode: uses the existing budgetRemaining logic', () => {
    const budgets: Budgets = { Food: 30000, Rent: 80000 };
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 12000 }),
      tx({ id: 'b', category: 'Rent', amount: 80000 }),
    ];
    expect(getRemainingBudget('category', budgets, 0, entries)).toBe(18000);
  });

  it('in total mode: totalBudget − total expenses', () => {
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 12000 }),
      tx({ id: 'b', category: 'Rent', amount: 20000 }),
    ];
    expect(getRemainingBudget('total', {}, 50000, entries)).toBe(18000);
  });

  it('in total mode: never lets income enter the math', () => {
    const entries = [
      tx({ id: 'a', category: 'Food', amount: 10000 }),
      tx({ id: 'b', type: 'income', category: 'Salary', amount: 999999 }),
    ];
    expect(getRemainingBudget('total', {}, 50000, entries)).toBe(40000);
  });

  it('in total mode: goes negative when overspent, never clamped', () => {
    const entries = [tx({ amount: 60000 })];
    expect(getRemainingBudget('total', {}, 50000, entries)).toBe(-10000);
  });

  it('in total mode: returns the full total budget for a month with no entries', () => {
    expect(getRemainingBudget('total', {}, 100000, [])).toBe(100000);
  });
});
