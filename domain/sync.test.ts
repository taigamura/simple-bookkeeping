import {
  addLocalTransaction,
  applySyncOperation,
  applySyncOperations,
  createSyncState,
  validateSyncOperation,
} from './sync';
import type { Transaction } from './types';

const transaction = (id: string): Transaction => ({
  id, timestamp: '2026-08-10T00:00:00.000Z', y: 2026, m: 7, day: 10,
  type: 'expense', amount: 1200, category: 'Food', note: id, repeat: 'never',
});

describe('household sync tracer bullet', () => {
  it('validates actor, household, operation, sequence, and version-vector contracts', () => {
    const state = createSyncState('home');
    const local = addLocalTransaction(state, 'phone-a', transaction('tx-a'));

    expect(local.operation).toMatchObject({ householdId: 'home', actorId: 'phone-a', sequence: 1, version: { 'phone-a': 1 } });
    expect(validateSyncOperation(local.operation, 'other-home')).toBe('wrong-household');
    expect(validateSyncOperation({ ...local.operation, sequence: 0 })).toBe('invalid-sequence');
    expect(validateSyncOperation({ ...local.operation, version: { 'phone-a': 2 } })).toBe('invalid-version');
  });

  it('converges two replicas after duplicate, delayed, and reordered delivery', () => {
    const a = createSyncState('home');
    const b = createSyncState('home');
    const first = addLocalTransaction(a, 'phone-a', transaction('tx-a'));
    const second = addLocalTransaction(b, 'phone-b', transaction('tx-b'));

    const aAfter = applySyncOperations(first.state, [second.operation, first.operation, second.operation]).state;
    const bAfter = applySyncOperations(second.state, [first.operation, first.operation, second.operation]).state;

    expect(aAfter).toEqual(bAfter);
    expect(aAfter.entries.map((entry) => entry.id)).toEqual(['tx-a', 'tx-b']);
    expect(new Set(aAfter.appliedOperations).size).toBe(2);
    expect(aAfter.versionVector).toEqual({ 'phone-a': 1, 'phone-b': 1 });
  });

  it('rejects malformed and cross-household operations without changing live state', () => {
    const state = createSyncState('home');
    const local = addLocalTransaction(state, 'phone-a', transaction('tx-a'));
    const foreign = { ...local.operation, householdId: 'attacker-home' };
    const malformed = { ...local.operation, transaction: { ...local.operation.transaction, amount: 1.5 } };

    expect(applySyncOperation(state, foreign).state).toBe(state);
    expect(applySyncOperation(state, malformed).state).toBe(state);
    expect(applySyncOperation(state, foreign).accepted).toBe(false);
    expect(applySyncOperation(state, malformed).accepted).toBe(false);
  });

  it('deduplicates a stable transaction identity even when operations repeat it', () => {
    const state = createSyncState('home');
    const first = addLocalTransaction(state, 'phone-a', transaction('same'));
    const duplicate = { ...first.operation, actorId: 'phone-b', operationId: 'phone-b:1', version: { 'phone-b': 1 } };
    const result = applySyncOperations(first.state, [duplicate]).state;

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('same');
    expect(result.appliedOperations).toEqual(['phone-a:1', 'phone-b:1']);
  });
});
