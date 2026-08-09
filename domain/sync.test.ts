import {
  addLocalTransaction,
  applySyncOperation,
  applySyncOperations,
  createSyncState,
  deleteLocalTransaction,
  editLocalTransaction,
  restoreLocalTransaction,
  rollbackLocalTransaction,
  validateSyncOperation,
  stageSyncOperations,
  createSyncStateTransfer,
  applySyncStateTransfer,
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

  it('converges concurrent edits, keeps the losing version, and attributes the winner', () => {
    const base = createSyncState('home');
    const added = addLocalTransaction(base, 'phone-a', transaction('same'));
    const aEdit = editLocalTransaction(added.state, 'phone-a', { ...transaction('same'), amount: 2000, note: 'a edit' });
    const bEdit = editLocalTransaction(added.state, 'phone-b', { ...transaction('same'), amount: 3000, note: 'b edit' });

    const aAfter = applySyncOperation(aEdit.state, bEdit.operation).state;
    const bAfter = applySyncOperation(bEdit.state, aEdit.operation).state;
    expect(aAfter).toEqual(bAfter);
    expect(aAfter.entries).toEqual([{ ...transaction('same'), amount: 2000, note: 'a edit' }]);
    expect(aAfter.attribution.same).toMatchObject({ createdBy: 'phone-a', lastEditedBy: 'phone-a' });
    expect(aAfter.history.same.map((entry) => entry.operationId)).toEqual(['phone-a:1', 'phone-a:2', 'phone-b:1']);
    expect(aAfter.history.same.map((entry) => entry.transaction?.note)).toEqual(['same', 'a edit', 'b edit']);
  });

  it('makes delete remove-wins against stale and concurrent edits', () => {
    const added = addLocalTransaction(createSyncState('home'), 'phone-a', transaction('gone'));
    const edit = editLocalTransaction(added.state, 'phone-b', { ...transaction('gone'), amount: 9999 });
    const deleted = deleteLocalTransaction(added.state, 'phone-a', 'gone');

    const aAfter = applySyncOperation(deleted.state, edit.operation).state;
    const bAfter = applySyncOperation(edit.state, deleted.operation).state;
    expect(aAfter).toEqual(bAfter);
    expect(aAfter.entries).toEqual([]);
    expect(aAfter.tombstones.gone.operationId).toBe('phone-a:2');
    expect(aAfter.history.gone).toHaveLength(3);
    expect(aAfter.attribution.gone.lastEditedBy).toBe('phone-a');
  });

  it('does not resurrect a tombstone and restores history as a new transaction', () => {
    const added = addLocalTransaction(createSyncState('home'), 'phone-a', transaction('gone'));
    const deleted = deleteLocalTransaction(added.state, 'phone-a', 'gone');
    const delayedEdit = { ...editLocalTransaction(added.state, 'phone-b', { ...transaction('gone'), amount: 8000 }).operation };
    const afterDelayed = applySyncOperation(deleted.state, delayedEdit).state;
    expect(afterDelayed.entries).toEqual([]);

    const restored = restoreLocalTransaction(afterDelayed, 'phone-a', 'gone');
    expect(restored.transaction.id).not.toBe('gone');
    expect(restored.transaction.amount).toBe(1200);
    expect(restored.state.entries).toEqual([restored.transaction]);
    expect(restored.state.tombstones.gone).toBeDefined();
    expect(restored.state.attribution[restored.transaction.id]).toMatchObject({ createdBy: 'phone-a', lastEditedBy: 'phone-a' });
  });

  it('restores the specifically selected historical version, not merely the latest one', () => {
    const added = addLocalTransaction(createSyncState('home'), 'phone-a', transaction('selected'));
    const edited = editLocalTransaction(added.state, 'phone-a', { ...transaction('selected'), amount: 2400, note: 'second' });
    const deleted = deleteLocalTransaction(edited.state, 'phone-a', 'selected');

    const restored = restoreLocalTransaction(deleted.state, 'phone-b', 'selected', 'phone-a:1');
    expect(restored.transaction.amount).toBe(1200);
    expect(restored.transaction.note).toBe('selected');
    expect(restored.transaction.id).not.toBe('selected');
    expect(restored.state.tombstones.selected).toEqual(deleted.state.tombstones.selected);
    expect(restored.state.entries.map((entry) => entry.id)).toEqual([restored.transaction.id]);
  });

  it('stages a material preview and commits a batch atomically with a byte-identical backup', () => {
    const added = addLocalTransaction(createSyncState('home'), 'phone-a', transaction('batch'));
    const edited = { ...editLocalTransaction(added.state, 'phone-b', { ...transaction('batch'), amount: 3300 }).operation };
    const invalid = { ...edited, operationId: 'phone-b:2', sequence: 2, version: { 'phone-b': 2 }, transaction: { ...edited.transaction, amount: 1.5 } };
    const before = JSON.stringify(added.state);

    const failed = stageSyncOperations(added.state, [edited, invalid]);
    expect(failed.state).toBe(added.state);
    expect(failed.accepted).toBe(false);
    expect(failed.failedOperationId).toBe('phone-b:2');

    const staged = stageSyncOperations(added.state, [edited]);
    expect(staged.preview).toEqual({ operationIds: ['phone-b:1'], added: [], edited: ['batch'], deleted: [] });
    expect(staged.rollback?.preMergeState).toBe(before);
    expect(JSON.stringify(added.state)).toBe(before);
    expect(staged.state.entries[0].amount).toBe(3300);
  });

  it('transfers retained history to a replacement replica without dropping tombstones', () => {
    const added = addLocalTransaction(createSyncState('home'), 'phone-a', transaction('kept'));
    const deleted = deleteLocalTransaction(added.state, 'phone-a', 'kept');
    const transfer = createSyncStateTransfer(deleted.state);
    const replacement = applySyncStateTransfer(createSyncState('home'), transfer);

    expect(replacement.state.entries).toEqual([]);
    expect(replacement.state.tombstones.kept).toEqual(deleted.state.tombstones.kept);
    expect(replacement.state.history.kept).toEqual(deleted.state.history.kept);
    expect(replacement.state.appliedOperations).toEqual(deleted.state.appliedOperations);
  });

  it('rolls a live record back through a new attributed edit', () => {
    const added = addLocalTransaction(createSyncState('home'), 'phone-a', transaction('live'));
    const edited = editLocalTransaction(added.state, 'phone-a', { ...transaction('live'), amount: 4500, note: 'changed' });
    const rolledBack = rollbackLocalTransaction(edited.state, 'phone-b', 'live', 'phone-a:1');

    expect(rolledBack.state.entries[0]).toEqual(transaction('live'));
    expect(rolledBack.operation.kind).toBe('edit-transaction');
    expect(rolledBack.state.history.live).toHaveLength(3);
    expect(rolledBack.state.attribution.live.lastEditedBy).toBe('phone-b');
  });
});
