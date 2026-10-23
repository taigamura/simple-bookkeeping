import type { Transaction } from '../domain';
import type { InboxEntry } from './contract';
import { mergeInbox } from './inbox';

const item = (over: Partial<InboxEntry>): InboxEntry => ({
  id: 'u1',
  createdAt: '2026-10-23T03:04:05.000Z',
  date: '2026-10-22',
  type: 'expense',
  amount: 850,
  category: 'Food',
  note: 'ランチ',
  ...over,
});

const existing: Transaction = {
  id: 'e1',
  timestamp: '2026-10-01T00:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 100,
  category: 'Food',
  note: '',
  repeat: 'never',
};

describe('mergeInbox', () => {
  it('turns an inbox item into a ledger transaction', () => {
    const { entries, mergedIds } = mergeInbox([existing], [item({})]);
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({
      id: 'siri-u1',
      timestamp: '2026-10-23T03:04:05.000Z',
      y: 2026,
      m: 9,
      day: 22,
      type: 'expense',
      amount: 850,
      category: 'Food',
      note: 'ランチ',
      repeat: 'never',
    });
    expect(mergedIds).toEqual(['u1']);
  });

  it('normalizes a Swift timestamp without milliseconds to the persisted ISO form', () => {
    const { entries } = mergeInbox([], [item({ createdAt: '2026-10-23T03:04:05Z' })]);
    expect(entries[0].timestamp).toBe('2026-10-23T03:04:05.000Z');
  });

  it('dedupes against already-merged entries but still reports the id for clearing', () => {
    const first = mergeInbox([existing], [item({})]);
    const second = mergeInbox(first.entries, [item({})]);
    expect(second.entries).toBe(first.entries);
    expect(second.mergedIds).toEqual(['u1']);
  });

  it('dedupes repeated ids inside one inbox read', () => {
    const { entries, mergedIds } = mergeInbox([], [item({}), item({ amount: 999 })]);
    expect(entries).toHaveLength(1);
    expect(mergedIds).toEqual(['u1']);
  });

  it.each([
    ['bad date', { date: '2026-02-30' }],
    ['garbage date', { date: 'yesterday' }],
    ['zero amount', { amount: 0 }],
    ['negative amount', { amount: -5 }],
    ['fractional amount', { amount: 12.5 }],
    ['bad type', { type: 'transfer' as never }],
    ['empty id', { id: '' }],
  ])('drops an invalid item (%s)', (_name, over) => {
    const { entries, mergedIds } = mergeInbox([existing], [item(over)]);
    expect(entries).toEqual([existing]);
    expect(mergedIds).toEqual([]);
  });

  it('keeps the category as given, even empty (the hook fills the fallback)', () => {
    const { entries } = mergeInbox([], [item({ category: '' })]);
    expect(entries[0].category).toBe('');
  });

  it('returns the same array when nothing is new', () => {
    const r = mergeInbox([existing], []);
    expect(r.entries).toBe(r.entries);
    expect(r).toEqual({ entries: [existing], mergedIds: [] });
  });
});
