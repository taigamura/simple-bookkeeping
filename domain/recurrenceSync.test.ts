import {
  addLocalRecurrenceRule,
  addRecurrenceException,
  applyRecurrenceSyncOperations,
  createRecurrenceSyncState,
  deleteLocalRecurrenceRule,
  editLocalRecurrenceRule,
  splitLocalRecurrenceRule,
  stableOccurrenceId,
} from './sync';
import type { RecurrenceRule } from './types';

const rule = (id = 'rent'): RecurrenceRule => ({
  id, timestamp: '2026-08-10T00:00:00.000Z', start: { y: 2026, m: 7, day: 10 },
  anchorDay: 10, type: 'expense', amount: 1000, category: 'Rent', note: id,
  repeat: 'monthly', weekendShift: 'off', exceptions: [],
});

describe('recurrence household sync', () => {
  it('uses one occurrence identity on every replica', () => {
    expect(stableOccurrenceId('rent', { y: 2026, m: 7, day: 10 })).toBe('rent@2026-08-10');
    expect(stableOccurrenceId('rent', { y: 2027, m: 1, day: 28 })).toBe('rent@2027-02-28');
  });

  it('unions concurrent single-occurrence exceptions after reordered delivery', () => {
    const base = addLocalRecurrenceRule(createRecurrenceSyncState('home'), 'phone-a', rule()).state;
    const a = addRecurrenceException(base, 'phone-a', 'rent', { y: 2026, m: 8, day: 10 });
    const b = addRecurrenceException(base, 'phone-b', 'rent', { y: 2026, m: 9, day: 10 });
    const left = applyRecurrenceSyncOperations(a.state, [b.operation]).state;
    const right = applyRecurrenceSyncOperations(b.state, [a.operation]).state;

    expect(left).toEqual(right);
    expect(left.rules[0].exceptions).toEqual(['2026-09-10', '2026-10-10']);
  });

  it('converges concurrent whole-rule edits and preserves the losing version', () => {
    const base = addLocalRecurrenceRule(createRecurrenceSyncState('home'), 'phone-a', rule()).state;
    const a = editLocalRecurrenceRule(base, 'phone-a', { ...rule(), amount: 2000 });
    const b = editLocalRecurrenceRule(base, 'phone-b', { ...rule(), amount: 3000 });
    const left = applyRecurrenceSyncOperations(a.state, [b.operation]).state;
    const right = applyRecurrenceSyncOperations(b.state, [a.operation]).state;

    expect(left).toEqual(right);
    expect(left.rules[0].amount).toBe(2000);
    expect(left.history.rent.map((entry) => entry.operationId)).toEqual(['phone-a:1', 'phone-a:2', 'phone-b:1']);
  });

  it('gives a this-and-future split a stable child identity', () => {
    const base = addLocalRecurrenceRule(createRecurrenceSyncState('home'), 'phone-a', rule()).state;
    const split = splitLocalRecurrenceRule(base, 'phone-a', 'rent', '2026-10-10', {
      ...rule('ignored'), start: { y: 2026, m: 9, day: 10 }, amount: 1200,
    });
    const state = split.state;
    expect(state.rules.find((item) => item.id === 'rent')?.endsBefore).toBe('2026-10-10');
    expect(state.rules.find((item) => item.id === 'rent:split:2026-10-10')?.amount).toBe(1200);
    const concurrent = splitLocalRecurrenceRule(base, 'phone-b', 'rent', '2026-10-10', {
      ...rule('ignored'), start: { y: 2026, m: 9, day: 10 }, amount: 900,
    });
    expect(applyRecurrenceSyncOperations(state, [concurrent.operation]).state)
      .toEqual(applyRecurrenceSyncOperations(concurrent.state, [split.operation]).state);
  });

  it('keeps deletion remove-wins against delayed edits and does not resurrect', () => {
    const added = addLocalRecurrenceRule(createRecurrenceSyncState('home'), 'phone-a', rule());
    const deleted = deleteLocalRecurrenceRule(added.state, 'phone-a', 'rent');
    const edited = editLocalRecurrenceRule(added.state, 'phone-b', { ...rule(), amount: 9000 });
    const state = applyRecurrenceSyncOperations(deleted.state, [edited.operation]).state;
    expect(state.rules).toEqual([]);
    expect(state.tombstones.rent).toBeDefined();
  });
});
