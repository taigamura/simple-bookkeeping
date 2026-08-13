import { categoryEntities, categoryIdFor, stableId, withCategoryId } from './identity';

describe('household identities', () => {
  it('creates cryptographically-shaped unique IDs for new entities', () => {
    const first = stableId();
    const second = stableId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it('keeps legacy category identities stable across migrations', () => {
    const categories = categoryEntities(['Food'], ['Salary']);
    expect(categoryIdFor('Food', 'expense', categories)).toBe(categoryIdFor('Food', 'expense', categories));
    expect(withCategoryId({ id: 't', timestamp: '2026-01-01T00:00:00.000Z', y: 2026, m: 0, day: 1, type: 'expense', amount: 1, category: 'Food', note: '' }, categories).categoryId)
      .toBe(categories[0].id);
  });

  it('gives a newly introduced category a cryptographically strong identity', () => {
    const [category] = categoryEntities(['Groceries'], []);

    expect(category.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(category.id).not.toBe(categoryIdFor('Groceries', 'expense', []));
  });
});
