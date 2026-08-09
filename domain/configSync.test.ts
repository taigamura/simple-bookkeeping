import {
  addLocalCategory,
  applyHouseholdConfigOperations,
  applyHouseholdConfigOperation,
  createHouseholdConfigState,
  deleteLocalCategory,
  renameLocalCategory,
  setLocalCategoryBudget,
  setLocalCurrency,
  setLocalTotalBudget,
} from './sync';

const food = { id: 'food', label: 'Food', type: 'expense' as const };

describe('household configuration sync', () => {
  it('unions concurrent category additions without importing device order', () => {
    const a = addLocalCategory(createHouseholdConfigState('home'), 'phone-a', food);
    const b = addLocalCategory(createHouseholdConfigState('home'), 'phone-b', { id: 'rent', label: 'Rent', type: 'expense' });
    const aAfter = applyHouseholdConfigOperations(a.state, [b.operation]).state;
    const bAfter = applyHouseholdConfigOperations(b.state, [a.operation]).state;

    expect(aAfter).toEqual(bAfter);
    expect(aAfter.categories.map((category) => category.id)).toEqual(['food', 'rent']);
    expect(aAfter).not.toHaveProperty('theme');
  });

  it('uses deterministic last-writer-wins for rename and keeps historical labels after deletion', () => {
    const added = addLocalCategory(createHouseholdConfigState('home'), 'phone-a', food);
    const aRename = renameLocalCategory(added.state, 'phone-a', 'food', 'Groceries');
    const bRename = renameLocalCategory(added.state, 'phone-b', 'food', 'Dining');
    const deleted = deleteLocalCategory(aRename.state, 'phone-a', 'food');
    const left = applyHouseholdConfigOperations(deleted.state, [bRename.operation]).state;
    const right = applyHouseholdConfigOperations(bRename.state, [aRename.operation, deleted.operation]).state;

    expect(left).toEqual(right);
    expect(left.categories).toEqual([]);
    expect(left.categoryHistory.food.map((category) => category.label)).toEqual(['Dining', 'Food', 'Groceries']);
  });

  it('merges total and per-category budgets independently, and recovers currency history', () => {
    const base = addLocalCategory(createHouseholdConfigState('home'), 'phone-a', food).state;
    const aBudget = setLocalCategoryBudget(base, 'phone-a', 'food', 30000);
    const bBudget = setLocalCategoryBudget(base, 'phone-b', 'food', 50000);
    const total = setLocalTotalBudget(aBudget.state, 'phone-a', 100000);
    const currency = setLocalCurrency(bBudget.state, 'phone-b', { symbol: '$', code: 'USD' });
    const left = applyHouseholdConfigOperations(total.state, [bBudget.operation, currency.operation]).state;
    const right = applyHouseholdConfigOperations(currency.state, [aBudget.operation, total.operation]).state;

    expect(left).toEqual(right);
    expect(left.budgets.food).toBe(30000);
    expect(left.totalBudget).toBe(100000);
    expect(left.currency).toEqual({ symbol: '$', code: 'USD' });
    expect(left.currencyHistory).toEqual([{ symbol: '¥', code: 'JPY' }, { symbol: '$', code: 'USD' }]);
  });

  it('keeps a category deletion remove-wins against a delayed budget update', () => {
    const added = addLocalCategory(createHouseholdConfigState('home'), 'phone-a', food);
    const budget = setLocalCategoryBudget(added.state, 'phone-b', 'food', 1000);
    const deleted = deleteLocalCategory(added.state, 'phone-a', 'food');
    const result = applyHouseholdConfigOperation(deleted.state, budget.operation).state;

    expect(result.categories).toEqual([]);
    expect(result.budgets).toEqual({});
    expect(result.deletedCategories.food).toBeDefined();
  });

  it('lets causally later writes replace earlier values on the same device', () => {
    let state = addLocalCategory(createHouseholdConfigState('home'), 'phone-a', food).state;
    state = renameLocalCategory(state, 'phone-a', 'food', 'Groceries').state;
    state = renameLocalCategory(state, 'phone-a', 'food', 'Dining').state;
    state = setLocalCategoryBudget(state, 'phone-a', 'food', 1000).state;
    state = setLocalCategoryBudget(state, 'phone-a', 'food', 2000).state;
    state = setLocalTotalBudget(state, 'phone-a', 10000).state;
    state = setLocalTotalBudget(state, 'phone-a', 20000).state;
    state = setLocalCurrency(state, 'phone-a', { symbol: '$', code: 'USD' }).state;
    state = setLocalCurrency(state, 'phone-a', { symbol: '€', code: 'EUR' }).state;

    expect(state.categories[0].label).toBe('Dining');
    expect(state.budgets.food).toBe(2000);
    expect(state.totalBudget).toBe(20000);
    expect(state.currency.code).toBe('EUR');
  });

  it('converges when rename is delivered before add and when the same ID is added concurrently', () => {
    const empty = createHouseholdConfigState('home');
    const addA = addLocalCategory(empty, 'phone-b', food);
    const rename = renameLocalCategory(addA.state, 'phone-a', 'food', 'Groceries');
    const addB = addLocalCategory(empty, 'phone-c', { ...food, label: 'Dining' });
    const operations = [rename.operation, addA.operation, addB.operation];

    const forward = applyHouseholdConfigOperations(empty, operations).state;
    const reverse = applyHouseholdConfigOperations(empty, [...operations].reverse()).state;
    expect(forward).toEqual(reverse);
    expect(forward.categories).toEqual([{ ...food, label: 'Groceries' }]);
  });

  it('removes an existing budget with its category and rejects zero as a persisted budget', () => {
    let state = addLocalCategory(createHouseholdConfigState('home'), 'phone-a', food).state;
    state = setLocalCategoryBudget(state, 'phone-a', 'food', 1000).state;
    state = deleteLocalCategory(state, 'phone-a', 'food').state;
    expect(state.budgets).toEqual({});
    expect(() => setLocalCategoryBudget(state, 'phone-a', 'food', 0)).toThrow();
  });

  it('canonicalizes concurrent histories and retains operation-bearing recovery data', () => {
    const base = createHouseholdConfigState('home');
    const a = setLocalTotalBudget(base, 'phone-a', 100);
    const b = setLocalTotalBudget(base, 'phone-b', 200);
    const left = applyHouseholdConfigOperation(a.state, b.operation).state;
    const right = applyHouseholdConfigOperation(b.state, a.operation).state;

    expect(left).toEqual(right);
    expect(left.history.map((entry) => entry.operationId)).toEqual(['phone-a:1', 'phone-b:1']);
  });
});
