/**
 * Category-editing rules (slice #7): add (trim/dedupe), remove (min 1),
 * reorder (neighbour swap), plus the fixed currency choices.
 */
import {
  CURRENCIES,
  addCategory,
  moveCategory,
  removeCategory,
} from './categories';

describe('addCategory', () => {
  it('appends a trimmed name', () => {
    expect(addCategory(['Food'], '  Rent ')).toEqual(['Food', 'Rent']);
  });

  it('ignores blank / whitespace-only input', () => {
    expect(addCategory(['Food'], '   ')).toEqual(['Food']);
    expect(addCategory(['Food'], '')).toEqual(['Food']);
  });

  it('rejects case-insensitive duplicates (unchanged list)', () => {
    const list = ['Food', 'Rent'];
    expect(addCategory(list, 'food')).toBe(list);
    expect(addCategory(list, 'RENT')).toBe(list);
  });
});

describe('removeCategory', () => {
  it('drops the entry at the index', () => {
    expect(removeCategory(['A', 'B', 'C'], 1)).toEqual(['A', 'C']);
  });

  it('keeps at least one category', () => {
    const solo = ['Only'];
    expect(removeCategory(solo, 0)).toBe(solo);
  });

  it('is a no-op for an out-of-range index', () => {
    const list = ['A', 'B'];
    expect(removeCategory(list, 5)).toBe(list);
    expect(removeCategory(list, -1)).toBe(list);
  });
});

describe('moveCategory', () => {
  it('swaps up (-1) and down (+1)', () => {
    expect(moveCategory(['A', 'B', 'C'], 1, -1)).toEqual(['B', 'A', 'C']);
    expect(moveCategory(['A', 'B', 'C'], 1, 1)).toEqual(['A', 'C', 'B']);
  });

  it('is a no-op at the ends', () => {
    const list = ['A', 'B', 'C'];
    expect(moveCategory(list, 0, -1)).toBe(list); // first can't go up
    expect(moveCategory(list, 2, 1)).toBe(list); // last can't go down
  });

  it('does not mutate the input array', () => {
    const list = ['A', 'B'];
    moveCategory(list, 0, 1);
    expect(list).toEqual(['A', 'B']);
  });
});

describe('CURRENCIES', () => {
  it('offers the four symbol/code pairs (decision 11)', () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual(['JPY', 'USD', 'EUR', 'GBP']);
    expect(CURRENCIES.map((c) => c.symbol)).toEqual(['¥', '$', '€', '£']);
  });
});
