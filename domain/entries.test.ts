/**
 * Pure edit/delete helpers (#43): `updateEntry` overwrites one entry's mutable
 * fields (type/amount/category/note) while preserving its identity and placement
 * (id/y/m/day/repeat); `removeEntry` drops exactly one entry. Both return new
 * arrays, never mutate their input, and no-op on a missing id.
 */
import { removeEntry, updateEntry, type EntryDraft } from './entries';
import type { Transaction } from './types';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'a',
  y: 2026,
  m: 6,
  day: 2,
  type: 'expense',
  amount: 1000,
  category: 'Food',
  note: 'Konbini',
  repeat: 'never',
  ...over,
});

const draft = (over: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'income',
  amountStr: '2500',
  category: 'Salary',
  note: 'Bonus',
  // Deliberately different y/m/day/repeat — updateEntry must ignore these.
  y: 2000,
  m: 0,
  day: 99,
  repeat: 'daily',
  ...over,
});

describe('updateEntry', () => {
  it('overwrites the matching entry’s fields but preserves id/y/m/day/repeat', () => {
    const entries = [tx(), tx({ id: 'b', category: 'Rent' })];
    const out = updateEntry(entries, 'a', draft());

    expect(out[0]).toEqual({
      id: 'a',
      y: 2026,
      m: 6,
      day: 2,
      type: 'income',
      amount: 2500,
      category: 'Salary',
      note: 'Bonus',
      repeat: 'never',
    });
    // Other entries are untouched.
    expect(out[1]).toEqual(entries[1]);
  });

  it('falls back to the category when the draft note is blank or the dash', () => {
    expect(updateEntry([tx()], 'a', draft({ note: '—' }))[0].note).toBe('Salary');
    expect(updateEntry([tx()], 'a', draft({ note: '  ' }))[0].note).toBe('Salary');
    expect(updateEntry([tx()], 'a', draft({ note: undefined }))[0].note).toBe('Salary');
  });

  it('is a no-op for a missing id (content unchanged) and returns a new array', () => {
    const entries = [tx(), tx({ id: 'b' })];
    const out = updateEntry(entries, 'missing', draft());
    expect(out).toEqual(entries);
    expect(out).not.toBe(entries);
  });

  it('never mutates the input array or its entries', () => {
    const original = tx();
    const entries = [original];
    const snapshot = { ...original };
    updateEntry(entries, 'a', draft());
    expect(entries).toEqual([snapshot]);
    expect(original).toEqual(snapshot);
  });
});

describe('removeEntry', () => {
  it('drops exactly the matching entry', () => {
    const entries = [tx(), tx({ id: 'b' }), tx({ id: 'c' })];
    const out = removeEntry(entries, 'b');
    expect(out.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('is a no-op for a missing id (content unchanged) and returns a new array', () => {
    const entries = [tx(), tx({ id: 'b' })];
    const out = removeEntry(entries, 'missing');
    expect(out).toEqual(entries);
    expect(out).not.toBe(entries);
  });

  it('never mutates the input array', () => {
    const entries = [tx(), tx({ id: 'b' })];
    const snapshot = [...entries];
    removeEntry(entries, 'a');
    expect(entries).toEqual(snapshot);
  });
});
