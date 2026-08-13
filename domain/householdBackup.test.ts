import { DEFAULT_STATE, type HouseholdState } from '../store/schema';
import {
  createHouseholdBackup,
  HOUSEHOLD_BACKUP_FORMAT,
  HOUSEHOLD_BACKUP_VERSION,
  HouseholdBackupError,
  previewHouseholdBackup,
  readHouseholdBackup,
  restoreHouseholdBackup,
  type HouseholdBackupPayload,
  type HouseholdBackupStore,
} from './householdBackup';
import {
  addLocalCategory,
  addLocalRecurrenceRule,
  addLocalTransaction,
  applySyncOperation,
  createHouseholdConfigState,
  createRecurrenceSyncState,
  createSyncState,
  deleteLocalTransaction,
  setLocalCategoryBudget,
  type SyncState,
} from './sync';
import type { RecurrenceRule, Transaction } from './types';

const HOUSEHOLD = 'home';

const groceries: Transaction = {
  id: 'tx-groceries',
  timestamp: '2026-03-04T09:00:00.000Z',
  y: 2026, m: 2, day: 4,
  type: 'expense', amount: 2400, category: 'Food', note: 'market',
};

const salary: Transaction = {
  id: 'tx-salary',
  timestamp: '2026-03-25T00:00:00.000Z',
  y: 2026, m: 2, day: 25,
  type: 'income', amount: 300000, category: 'Salary', note: '',
};

const rent: RecurrenceRule = {
  id: 'rule-rent',
  timestamp: '2026-01-01T00:00:00.000Z',
  start: { y: 2026, m: 0, day: 1 },
  anchorDay: 1,
  type: 'expense', amount: 90000, category: 'Home', note: 'rent',
  repeat: 'monthly', weekendShift: 'after', exceptions: [],
};

/** A household with a real operation history: an add, an edit-by-delete, and a tombstone. */
function livedInSync(): SyncState {
  const added = addLocalTransaction(createSyncState(HOUSEHOLD), 'phone-a', groceries);
  const second = addLocalTransaction(added.state, 'phone-b', salary);
  const removed = deleteLocalTransaction(second.state, 'phone-a', salary.id);
  return removed.state;
}

function livedInPayload(): HouseholdBackupPayload {
  const sync = livedInSync();
  const config = setLocalCategoryBudget(
    addLocalCategory(createHouseholdConfigState(HOUSEHOLD), 'phone-a', { id: 'cat-food', label: 'Food', type: 'expense' }).state,
    'phone-a',
    'cat-food',
    30000,
  ).state;
  const recurrence = addLocalRecurrenceRule(createRecurrenceSyncState(HOUSEHOLD), 'phone-a', rent).state;
  const household: HouseholdState = {
    entries: sync.entries,
    recurrenceRules: recurrence.rules,
    categories: [{ id: 'cat-food', label: 'Food', type: 'expense' }],
    budgets: { 'cat-food': 30000 },
    currency: DEFAULT_STATE.currency,
  };
  return { household, sync, config, recurrence };
}

function memoryStore(initial: HouseholdBackupPayload): HouseholdBackupStore & { current: HouseholdBackupPayload } {
  return {
    current: initial,
    async load() { return JSON.parse(JSON.stringify(this.current)) as HouseholdBackupPayload; },
    async save(payload) { this.current = JSON.parse(JSON.stringify(payload)) as HouseholdBackupPayload; },
  };
}

describe('full-fidelity household backup', () => {
  const payload = livedInPayload();
  const createdAt = '2026-08-10T00:00:00.000Z';
  const file = createHouseholdBackup(payload, { createdAt });

  it('round-trips the household and its sync metadata exactly', () => {
    const backup = readHouseholdBackup(file);
    expect(backup.format).toBe(HOUSEHOLD_BACKUP_FORMAT);
    expect(backup.version).toBe(HOUSEHOLD_BACKUP_VERSION);
    expect(backup.householdId).toBe(HOUSEHOLD);
    expect(backup.createdAt).toBe(createdAt);
    // Household records are normalized on write, exactly as `load()` normalizes
    // them, so a one-time entry is pinned to `repeat: 'never'` rather than being
    // able to come back as an infinite series.
    expect(backup.payload).toEqual({
      ...payload,
      household: { ...payload.household, entries: [{ ...groceries, repeat: 'never' }] },
    });
    // Tombstones, attribution, the replay fence, and history all survive.
    expect(backup.payload.sync.tombstones[salary.id]).toEqual(payload.sync.tombstones[salary.id]);
    expect(backup.payload.sync.attribution[groceries.id].createdBy).toBe('phone-a');
    expect(backup.payload.sync.appliedOperations).toEqual(payload.sync.appliedOperations);
    expect(backup.payload.sync.history[salary.id]).toHaveLength(2);
    expect(backup.payload.recurrence?.rules).toEqual([rent]);
    expect(backup.payload.config?.budgets['cat-food']).toBe(30000);
    // Re-serializing a restored backup reproduces the same bytes.
    expect(createHouseholdBackup(backup.payload, { createdAt })).toBe(file);
  });

  it('preserves an explicitly stored transaction repeat value', () => {
    const repeatingEntry = { ...groceries, repeat: 'monthly' as const };
    const repeatingPayload = {
      ...payload,
      household: { ...payload.household, entries: [repeatingEntry] },
      sync: { ...payload.sync, entries: [repeatingEntry] },
    };
    const restored = readHouseholdBackup(createHouseholdBackup(repeatingPayload, { createdAt }));
    expect(restored.payload.household.entries[0].repeat).toBe('monthly');
    expect(restored.payload.sync.entries[0].repeat).toBe('monthly');
  });

  it('excludes device-local preferences even when a file carries them', () => {
    const tampered = JSON.parse(file) as { payload: Record<string, unknown> };
    tampered.payload.device = { theme: 'dark', motion: 'off', expenseCategoryOrder: ['cat-food'] };
    tampered.payload.household = { ...(tampered.payload.household as object), theme: 'dark' };
    const restored = readHouseholdBackup(JSON.stringify(tampered));
    expect(Object.keys(restored.payload).sort()).toEqual(['config', 'household', 'recurrence', 'sync']);
    expect(restored.payload.household).not.toHaveProperty('theme');
  });

  it('never carries household key material', () => {
    expect(file).not.toMatch(/householdKey|passphrase|invitation/i);
  });

  it('previews the restore without writing anything', () => {
    expect(previewHouseholdBackup(file)).toEqual({
      householdId: HOUSEHOLD,
      createdAt,
      version: HOUSEHOLD_BACKUP_VERSION,
      entries: 1,
      recurrenceRules: 1,
      categories: 1,
      budgets: 1,
      tombstones: 1,
      attributed: 2,
      historyEntries: 3,
      appliedOperations: 3,
      includesConfig: true,
      includesRecurrence: true,
    });
  });

  it('reads a legacy household written before entries carried timestamps', () => {
    const legacy = JSON.parse(file) as { payload: { household: HouseholdState } };
    const [entry] = legacy.payload.household.entries as Partial<Transaction>[];
    delete entry.timestamp;
    const restored = readHouseholdBackup(JSON.stringify(legacy));
    expect(restored.payload.household.entries[0].timestamp).toBe('2026-03-04T12:00:00.000Z');
    expect(restored.payload.household.entries[0].timestampInferred).toBe(true);
  });

  it('reads a backup whose household never replicated config or recurrence', () => {
    const minimal = createHouseholdBackup(
      { household: { ...payload.household, recurrenceRules: [] }, sync: payload.sync },
      { createdAt },
    );
    const restored = readHouseholdBackup(minimal);
    expect(restored.payload.config).toBeUndefined();
    expect(restored.payload.recurrence).toBeUndefined();
    expect(previewHouseholdBackup(minimal).includesConfig).toBe(false);
  });

  it('rejects corrupt, newer, and cross-household files', async () => {
    expect(() => readHouseholdBackup('not json')).toThrow(new HouseholdBackupError('invalid-backup'));
    expect(() => readHouseholdBackup(JSON.stringify({ format: 'kaji.csv', version: 1 })))
      .toThrow(new HouseholdBackupError('invalid-backup'));
    expect(() => readHouseholdBackup(JSON.stringify({ ...JSON.parse(file), version: HOUSEHOLD_BACKUP_VERSION + 1 })))
      .toThrow(new HouseholdBackupError('unsupported-version'));

    const truncated = JSON.parse(file) as { payload: { household: HouseholdState } };
    truncated.payload.household.entries = [{ ...groceries, amount: -5 }];
    expect(() => readHouseholdBackup(JSON.stringify(truncated)))
      .toThrow(new HouseholdBackupError('invalid-backup'));

    const foreign = JSON.parse(file) as { payload: { recurrence: { householdId: string } } };
    foreign.payload.recurrence.householdId = 'other-home';
    expect(() => readHouseholdBackup(JSON.stringify(foreign)))
      .toThrow(new HouseholdBackupError('wrong-household'));
    expect(() => restoreHouseholdBackup(memoryStore({ ...payload, sync: createSyncState('other-home') }), file, { confirm: true }))
      .rejects.toEqual(new HouseholdBackupError('wrong-household'));
  });

  it('rejects deep metadata corruption and projection disagreement before restore', () => {
    const tampered = JSON.parse(file) as { payload: HouseholdBackupPayload };
    tampered.payload.sync.history[salary.id][0].transaction!.amount = -1;
    expect(() => readHouseholdBackup(JSON.stringify(tampered)))
      .toThrow(new HouseholdBackupError('invalid-backup'));

    const mismatch = JSON.parse(file) as { payload: HouseholdBackupPayload };
    mismatch.payload.household.currency = { code: 'USD', symbol: '$' };
    expect(() => readHouseholdBackup(JSON.stringify(mismatch)))
      .toThrow(new HouseholdBackupError('invalid-backup'));
  });

  it('rejects a file whose header claims a different household than its payload', () => {
    const relabelled = { ...JSON.parse(file), householdId: 'other-home' };
    expect(() => readHouseholdBackup(JSON.stringify(relabelled)))
      .toThrow(new HouseholdBackupError('wrong-household'));
  });

  it('restores through a store and can roll back to the prior household', async () => {
    const before: HouseholdBackupPayload = {
      household: { ...payload.household, entries: [], recurrenceRules: [] },
      sync: createSyncState(HOUSEHOLD),
    };
    const store = memoryStore(before);
    await expect(restoreHouseholdBackup(store, file)).rejects
      .toEqual(new HouseholdBackupError('confirmation-required'));
    const restore = await restoreHouseholdBackup(store, file, { confirm: true });
    expect(restore.preview.entries).toBe(1);
    expect(store.current.sync.appliedOperations).toEqual(payload.sync.appliedOperations);

    await restore.rollback();
    expect(store.current).toEqual(before);
  });

  it('puts the prior household back when the write fails', async () => {
    const before: HouseholdBackupPayload = { household: payload.household, sync: createSyncState(HOUSEHOLD) };
    const saved: HouseholdBackupPayload[] = [];
    const store: HouseholdBackupStore = {
      load: async () => before,
      save: async (next) => {
        saved.push(next);
        if (saved.length === 1) throw new Error('disk full');
      },
    };
    await expect(restoreHouseholdBackup(store, file, { confirm: true })).rejects
      .toEqual(new HouseholdBackupError('restore-failed'));
    expect(saved).toHaveLength(2);
    expect(saved[1]).toBe(before);
  });

  it('writes nothing when the file is rejected', async () => {
    const store = memoryStore({ household: payload.household, sync: createSyncState(HOUSEHOLD) });
    const untouched = store.current;
    await expect(restoreHouseholdBackup(store, '{"format":"kaji.household-backup"}')).rejects
      .toEqual(new HouseholdBackupError('unsupported-version'));
    expect(store.current).toBe(untouched);
  });

  it('keeps the replay fence, so replaying a backed-up operation changes nothing', () => {
    const restored = readHouseholdBackup(file).payload.sync;
    const replayed = applySyncOperation(restored, {
      kind: 'add-transaction',
      operationId: 'phone-a:1',
      householdId: HOUSEHOLD,
      actorId: 'phone-a',
      sequence: 1,
      version: { 'phone-a': 1 },
      transaction: { ...groceries, amount: 999999 },
    });
    expect(replayed.accepted).toBe(false);
    expect(replayed.state.entries).toEqual(restored.entries);
  });

  it('keeps deletes final after a restore', () => {
    const restored = readHouseholdBackup(file).payload.sync;
    const resurrect = applySyncOperation(restored, {
      kind: 'add-transaction',
      operationId: 'phone-b:9',
      householdId: HOUSEHOLD,
      actorId: 'phone-b',
      sequence: 9,
      version: { 'phone-b': 9 },
      transaction: salary,
    });
    expect(resurrect.accepted).toBe(true);
    expect(resurrect.state.entries.some((entry) => entry.id === salary.id)).toBe(false);
  });
});
