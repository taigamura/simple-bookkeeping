/**
 * Budgets domain tests (#49/#50 acceptance criteria): the pure set/clear
 * transforms, the any-budget-set predicate, pruning on category deletion, and
 * the month's remaining-budget math.
 */
import {
  setBudget,
  clearBudget,
  hasAnyBudget,
  budgetRemaining,
  pruneBudgets,
  type Budgets,
} from './budgets';
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
