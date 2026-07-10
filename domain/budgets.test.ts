/**
 * Budgets domain tests (#49 acceptance criteria): the pure set/clear
 * transforms, the any-budget-set predicate, and pruning on category deletion.
 */
import { setBudget, clearBudget, hasAnyBudget, pruneBudgets, type Budgets } from './budgets';

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
