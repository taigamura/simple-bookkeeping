import { createSyncState, addLocalTransaction, deleteLocalTransaction, editLocalTransaction } from './sync';
import { householdSyncStatus, syncFailureMessage, syncHistoryRows } from './syncPresentation';
import type { Transaction } from './types';

const tx = (id = 'entry-1'): Transaction => ({
  id, timestamp: '2026-07-02T12:00:00.000Z', y: 2026, m: 6, day: 2,
  type: 'expense', amount: 1200, category: 'Food', note: 'private note', repeat: 'never',
});

describe('household sync presentation', () => {
  it('keeps the four statuses foreground and nearby only, without implying remote sync', () => {
    expect(householdSyncStatus({ paired: false, foreground: true, partnerPresent: true, queuedOperationCount: 0 }).status).toBe('offline');
    expect(householdSyncStatus({ paired: true, foreground: true, partnerPresent: false, queuedOperationCount: 1 })).toMatchObject({ status: 'offline', syncNow: 'partner-absent' });
    expect(householdSyncStatus({ paired: true, foreground: true, partnerPresent: true, queuedOperationCount: 1 }).status).toBe('syncing');
    expect(householdSyncStatus({ paired: true, foreground: true, partnerPresent: true, queuedOperationCount: 0 }).status).toBe('paired');
    expect(householdSyncStatus({ paired: true, foreground: true, partnerPresent: true, queuedOperationCount: 0, error: 'transport' }).status).toBe('error');
  });

  it('turns audit history into safe attributed rows and omits notes', () => {
    let state = createSyncState('home');
    const added = addLocalTransaction(state, 'phone-a', tx()); state = added.state;
    const edited = editLocalTransaction(state, 'phone-b', { ...tx(), amount: 1300 }); state = edited.state;
    state = deleteLocalTransaction(state, 'phone-a', 'entry-1').state;
    const rows = syncHistoryRows(state);
    expect(rows.map((row) => row.change)).toEqual(expect.arrayContaining(['added', 'edited', 'deleted']));
    expect(rows.find((row) => row.change === 'edited')).toMatchObject({ actorId: 'phone-b' });
    expect(rows.find((row) => row.change === 'deleted')?.attribution).toMatchObject({ createdBy: 'phone-a', lastEditedBy: 'phone-a' });
    expect(JSON.stringify(rows)).not.toContain('private note');
  });

  it('provides bilingual staged-failure messaging without claiming rollback succeeded', () => {
    expect(syncFailureMessage('rollback')).toEqual({
      title: 'Restore could not be completed',
      message: 'Nothing was changed. The current entry and its history were kept.',
    });
    expect(syncFailureMessage('partner-absent', 'ja').message).toContain('変更はありません');
  });
});
