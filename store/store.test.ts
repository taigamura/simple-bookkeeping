/**
 * Store round-trip + resilience tests (Foundation #2 + slice #3 criteria:
 * "saving then reloading state returns the persisted `theme`" and a round-trip
 * for `entries`).
 *
 * Most cases drive the store through an in-memory `Persistence` — the store's
 * swap seam — so they assert the envelope/merge/degradation logic without any
 * native dependency. One case drives the *default* store, which talks to real
 * AsyncStorage (mocked in jest.setup.js), to prove that wiring round-trips too.
 */
import { createStore } from './store';
import { createMemoryPersistence } from './persistence';
import { DEFAULT_STATE, SCHEMA_VERSION, type AppState } from './schema';
import {
  saveLedgerItem,
  type EntryDraft,
  type RecurrenceRule,
  type Transaction,
} from '../domain';
import { QUICK_ENTRY_COMMAND_VERSION, type QuickEntryCommand } from '../domain';

/** A full AppState with the given overrides, so tests state only what matters. */
const stateWith = (over: Partial<AppState> = {}): AppState => ({
  ...DEFAULT_STATE,
  ...over,
});

const sampleEntry: Transaction = {
  id: 'e1',
  y: 2026,
  m: 6,
  day: 2,
  timestamp: '2026-07-02T03:04:05.000Z',
  type: 'expense',
  amount: 850,
  category: 'Food',
  note: 'Food',
  repeat: 'never',
};

const quickCommand: QuickEntryCommand = {
  version: QUICK_ENTRY_COMMAND_VERSION,
  source: 'widget',
  id: 'coffee-1',
  timestamp: '2026-08-10T00:00:00.000Z',
  amount: 500,
  category: 'Food',
  note: 'Coffee',
  date: { y: 2026, m: 7, day: 10 },
};

describe('createStore', () => {
  it('reconciles concurrent and retried quick-entry commands exactly once', async () => {
    const persistence = createMemoryPersistence();
    const store = createStore(persistence);
    await Promise.all([
      store.queueQuickEntryCommand(quickCommand),
      store.queueQuickEntryCommand(quickCommand),
    ]);

    const first = await store.reconcileQuickEntryCommands(stateWith());
    const second = await store.reconcileQuickEntryCommands(first.state);

    expect(first.state.entries).toEqual([expect.objectContaining({ id: 'quick:widget:coffee-1' })]);
    expect(second.state).toBe(first.state);
    expect(await persistence.readQuickEntryQueue!()).toBe('[]');
  });

  it('quarantines malformed commands while allowing valid commands to recover', async () => {
    const persistence = createMemoryPersistence();
    const store = createStore(persistence);
    await store.queueQuickEntryCommand({ ...quickCommand, amount: 0 });
    await store.queueQuickEntryCommand(quickCommand);

    const result = await store.reconcileQuickEntryCommands(stateWith());

    expect(result.quarantined).toBe(1);
    expect(result.state.entries).toHaveLength(1);
    expect(JSON.parse((await store.readQuickEntryQuarantine())!)).toEqual([
      expect.objectContaining({ amount: 0 }),
    ]);
  });

  it('migrates a v1 envelope once and separates household identities from device state', async () => {
    const { household: _household, device: _device, ...legacyState } = stateWith({ entries: [sampleEntry] });
    const persistence = createMemoryPersistence(JSON.stringify({ version: 1, state: legacyState }));
    const store = createStore(persistence);

    const loaded = await store.load();
    expect(loaded.entries[0].categoryId).toMatch(/^legacy-expense-/);
    expect(loaded.household.entries[0].categoryId).toBe(loaded.entries[0].categoryId);
    expect(loaded.device.expenseCategoryOrder).toContain(loaded.household.categories[0].id);

    const migratedBlob = await persistence.read();
    expect(JSON.parse(migratedBlob!).version).toBe(SCHEMA_VERSION);
    await store.load();
    expect(await persistence.read()).toBe(migratedBlob);
  });

  it('migrates the complete legacy envelope without losing household or device data', async () => {
    const legacyEntry = { ...sampleEntry, category: 'Groceries' };
    const legacyRule: RecurrenceRule = {
      id: 'r1', timestamp: '2026-07-01T00:00:00.000Z', start: { y: 2026, m: 6, day: 1 },
      anchorDay: 1, type: 'expense', amount: 1200, category: 'Groceries', note: 'weekly',
      repeat: 'monthly', weekendShift: 'off', exceptions: [],
    };
    const { household: _household, device: _device, ...legacyState } = stateWith({
      entries: [legacyEntry], recurrenceRules: [legacyRule], expCats: ['Groceries'], incCats: ['Salary'],
      budgets: { Groceries: 30000 }, currency: { symbol: '$', code: 'USD' }, theme: 'light',
      budgetMode: 'total', totalBudget: 50000, calendarView: 'numbers', motion: 'reduced', summaryGranularity: 'annual',
    });
    const persistence = createMemoryPersistence(JSON.stringify({ version: 1, state: legacyState }));

    const loaded = await createStore(persistence).load();

    expect(loaded.household.entries).toEqual([expect.objectContaining({ category: 'Groceries', categoryId: expect.any(String) })]);
    expect(loaded.household.recurrenceRules).toEqual([expect.objectContaining({ category: 'Groceries', categoryId: expect.any(String) })]);
    expect(loaded.household.budgets).toEqual({ [loaded.household.categories[0].id]: 30000 });
    expect(loaded.household.currency).toEqual({ symbol: '$', code: 'USD' });
    expect(loaded.device).toMatchObject({ theme: 'light', budgetMode: 'total', totalBudget: 50000, calendarView: 'numbers', motion: 'reduced', summaryGranularity: 'annual' });
    expect(loaded.device.expenseCategoryOrder).toEqual([loaded.household.categories[0].id]);
  });

  it('stashes structurally invalid household or device payloads', async () => {
    const blob = JSON.stringify({ version: SCHEMA_VERSION, state: { ...stateWith(), household: { entries: [] }, device: stateWith().device } });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('keeps persisted category references during normalization', async () => {
    const categoryId = 'category-1';
    const blob = JSON.stringify({ version: SCHEMA_VERSION, state: stateWith({
      entries: [{ ...sampleEntry, categoryId }],
      household: { ...DEFAULT_STATE.household, entries: [{ ...sampleEntry, categoryId }] },
    }) });
    const loaded = await createStore(createMemoryPersistence(blob)).load();

    expect(loaded.entries[0].categoryId).toBe(categoryId);
    expect(loaded.household.entries[0].categoryId).toBe(categoryId);
  });

  it('round-trips saved state: save then load returns the persisted theme', async () => {
    const store = createStore(createMemoryPersistence());

    await store.save(stateWith({ theme: 'light' }));

    expect((await store.load()).theme).toBe('light');
  });

  it('backfills timestamps on legacy entries and recurrence rules', async () => {
    const legacyEntry = Object.fromEntries(
      Object.entries(sampleEntry).filter(([key]) => key !== 'timestamp'),
    );
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      {
        type: 'expense',
        amountStr: '850',
        category: 'Food',
        y: 2026,
        m: 6,
        day: 2,
        repeat: 'monthly',
      },
      'off',
    );
    const legacyRule = Object.fromEntries(
      Object.entries(ledger.recurrenceRules[0]).filter(([key]) => key !== 'timestamp'),
    );
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith({
        entries: [legacyEntry as Transaction],
        recurrenceRules: [legacyRule as RecurrenceRule],
      }),
    });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded.entries[0].timestamp).toBe('2026-07-02T12:00:00.000Z');
    expect(loaded.entries[0].timestampInferred).toBe(true);
    expect(loaded.recurrenceRules[0].timestamp).toBe('2026-07-02T12:00:00.000Z');
    expect(loaded.recurrenceRules[0].timestampInferred).toBe(true);
  });

  it('round-trips the ledger: saved entries survive a reload', async () => {
    const store = createStore(createMemoryPersistence());

    await store.save(stateWith({ entries: [sampleEntry] }));

    expect((await store.load()).entries).toEqual([sampleEntry]);
  });

  it('recovers readable legacy ledger data when the active key is empty', async () => {
    const legacyBlob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith({ entries: [sampleEntry] }),
    });
    const persistence = createMemoryPersistence(null);
    persistence.setRecoveryCandidates([legacyBlob]);
    const store = createStore(persistence);

    const loaded = await store.load();

    expect(loaded.entries).toEqual([sampleEntry]);
    const recoveredEnvelope = JSON.parse((await persistence.read())!);
    expect(recoveredEnvelope.version).toBe(SCHEMA_VERSION);
    expect(recoveredEnvelope.state.entries).toEqual([sampleEntry]);
    expect(recoveredEnvelope.state.household.entries).toEqual([expect.objectContaining({ id: sampleEntry.id })]);
  });

  it('keeps an active ledger instead of overwriting it from a recovery candidate', async () => {
    const activeEntry = { ...sampleEntry, id: 'active', amount: 1000 };
    const activeBlob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith({ entries: [activeEntry] }),
    });
    const legacyBlob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith({ entries: [sampleEntry] }),
    });
    const persistence = createMemoryPersistence(activeBlob);
    persistence.setRecoveryCandidates([legacyBlob]);
    const store = createStore(persistence);

    const loaded = await store.load();

    expect(loaded.entries).toEqual([activeEntry]);
    expect(await persistence.read()).toBe(activeBlob);
  });

  it('ignores empty recovery candidates when the active key is empty', async () => {
    const emptyLegacyBlob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith(),
    });
    const persistence = createMemoryPersistence(null);
    persistence.setRecoveryCandidates([emptyLegacyBlob]);
    const store = createStore(persistence);

    const loaded = await store.load();

    expect(loaded).toEqual(DEFAULT_STATE);
    expect(await persistence.read()).toBeNull();
  });

  it('round-trips persisted infinite recurrence rules', async () => {
    const draft: EntryDraft = {
      type: 'expense',
      amountStr: '850',
      category: 'Food',
      note: 'Lunch',
      y: 2027,
      m: 0,
      day: 31,
      repeat: 'monthly',
    };
    const ledger = saveLedgerItem({ entries: [], recurrenceRules: [] }, draft, 'after');
    const store = createStore(createMemoryPersistence());

    await store.save(stateWith(ledger));

    expect((await store.load()).recurrenceRules).toEqual(ledger.recurrenceRules);
  });

  it('rejects recurrence rules with impossible persisted exception dates', async () => {
    const draft: EntryDraft = {
      type: 'expense',
      amountStr: '850',
      category: 'Food',
      note: 'Lunch',
      y: 2027,
      m: 0,
      day: 31,
      repeat: 'monthly',
    };
    const ledger = saveLedgerItem({ entries: [], recurrenceRules: [] }, draft, 'after');
    const invalidState = stateWith({
      ...ledger,
      recurrenceRules: [{ ...ledger.recurrenceRules[0], exceptions: ['2027-99-99'] }],
    });
    const blob = JSON.stringify({ version: SCHEMA_VERSION, state: invalidState });
    const store = createStore(createMemoryPersistence(blob));

    expect(await store.load()).toEqual(DEFAULT_STATE);
    expect(store.wasLastLoadCorrupt()).toBe(true);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('migrates legacy materialized repeats to one-time history without inventing series', async () => {
    const { recurrenceRules: _recurrenceRules, ...legacyState } = stateWith({
      entries: [{ ...sampleEntry, repeat: 'daily' }],
    });
    const store = createStore(
      createMemoryPersistence(JSON.stringify({ version: SCHEMA_VERSION, state: legacyState })),
    );

    const loaded = await store.load();

    expect(loaded.entries).toEqual([{ ...sampleEntry, repeat: 'never' }]);
    expect(loaded.recurrenceRules).toEqual([]);
  });

  it('round-trips budgets (#49): saved category budgets survive a reload', async () => {
    const store = createStore(createMemoryPersistence());

    await store.save(stateWith({ budgets: { Food: 30000, Rent: 80000 } }));

    expect((await store.load()).budgets).toEqual({ Food: 30000, Rent: 80000 });
  });

  it('defaults budgets to empty when loading a pre-#49 blob without the field', async () => {
    // A same-version blob persisted before the budgets field existed: the
    // merge-by-known-keys load must fill it from defaults, no version bump.
    const { budgets: _budgets, ...legacyState } = stateWith({ theme: 'light' });
    const blob = JSON.stringify({ version: SCHEMA_VERSION, state: legacyState });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded.budgets).toEqual({});
    expect(loaded.theme).toBe('light');
  });

  it('loads valid older envelopes without additive fields and preserves ledger data', async () => {
    const {
      currency: _currency,
      budgets: _budgets,
      budgetMode: _budgetMode,
      totalBudget: _totalBudget,
      calendarView: _calendarView,
      motion: _motion,
      summaryGranularity: _summaryGranularity,
      ...legacyState
    } = stateWith({ entries: [sampleEntry], theme: 'light' });
    const blob = JSON.stringify({ version: SCHEMA_VERSION, state: legacyState });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded.entries).toEqual([sampleEntry]);
    expect(loaded.theme).toBe('light');
    expect(loaded.currency).toEqual(DEFAULT_STATE.currency);
    expect(loaded.budgets).toEqual({});
    expect(loaded.budgetMode).toBe('category');
    expect(loaded.totalBudget).toBe(0);
    // Blobs written before the calendar view toggle shipped get the dot default.
    expect(loaded.calendarView).toBe('dots');
    // Likewise for motion: pre-ADR-0003 blobs follow the OS reduce-motion flag.
    expect(loaded.motion).toBe('system');
    // Blobs written before the Summary granularity toggle shipped open monthly.
    expect(loaded.summaryGranularity).toBe('monthly');
  });

  it('round-trips a chosen summary granularity', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith({ summaryGranularity: 'annual' }),
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toMatchObject({ summaryGranularity: 'annual' });
  });

  it('stashes an unrecognised summary granularity before using defaults', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...stateWith(), summaryGranularity: 'quarterly' },
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('round-trips a chosen motion preference', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith({ motion: 'reduced' }),
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toMatchObject({ motion: 'reduced' });
  });

  it('stashes an unrecognised motion preference before using defaults', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...stateWith(), motion: 'subtle' },
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('round-trips a chosen calendar view', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: stateWith({ calendarView: 'numbers' }),
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toMatchObject({ calendarView: 'numbers' });
  });

  it('stashes an unrecognised calendar view before using defaults', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...stateWith(), calendarView: 'bars' },
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('ignores a legacy premium field when loading older persisted state (#77)', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: {
        ...stateWith({ entries: [sampleEntry], theme: 'light' }),
        premium: true,
      },
    });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded).toEqual(stateWith({ entries: [sampleEntry], theme: 'light' }));
    expect(loaded).not.toHaveProperty('premium');
    expect(store.wasLastLoadCorrupt()).toBe(false);
  });

  it('ignores removed Lock and Open-to fields in persisted state', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: {
        ...stateWith({ entries: [sampleEntry] }),
        lockEnabled: true,
        openTo: 'entry',
      },
    });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded.entries).toEqual([sampleEntry]);
    expect(loaded).not.toHaveProperty('lockEnabled');
    expect(loaded).not.toHaveProperty('openTo');
    expect(store.wasLastLoadCorrupt()).toBe(false);
  });

  it('round-trips through the default AsyncStorage-backed store', async () => {
    // No persistence arg → default asyncStoragePersistence (AsyncStorage mock).
    const store = createStore();

    await store.save(stateWith({ theme: 'light', entries: [sampleEntry] }));

    const loaded = await store.load();
    expect(loaded.theme).toBe('light');
    expect(loaded.entries).toEqual([sampleEntry]);
  });

  it('returns defaults (empty ledger, seeded categories) when nothing persisted', async () => {
    const store = createStore(createMemoryPersistence(null));

    const loaded = await store.load();
    expect(loaded).toEqual(DEFAULT_STATE);
    expect(loaded.entries).toEqual([]);
    expect(loaded.expCats.length).toBeGreaterThan(0);
  });

  it('degrades to defaults on corrupt JSON instead of throwing', async () => {
    const store = createStore(createMemoryPersistence('{not valid json'));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
  });

  it('degrades to defaults when the schema version does not match', async () => {
    const stale = JSON.stringify({
      version: SCHEMA_VERSION + 1,
      state: stateWith({ theme: 'light' }),
    });
    const store = createStore(createMemoryPersistence(stale));

    expect(await store.load()).toEqual(DEFAULT_STATE);
  });

  it('stashes blobs missing core fields instead of silently filling ledger defaults', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { theme: 'light', bogus: 42 },
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(store.wasLastLoadCorrupt()).toBe(true);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('drops unknown top-level and nested transaction fields from otherwise valid state', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: {
        ...stateWith({ entries: [{ ...sampleEntry, unexpectedNested: true } as Transaction] }),
        bogus: 42,
      },
    });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded).toEqual(stateWith({ entries: [sampleEntry] }));
    expect(loaded).not.toHaveProperty('bogus');
    expect(loaded.entries[0]).not.toHaveProperty('unexpectedNested');
  });

  it('stashes syntactically valid but structurally invalid state before using defaults', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...stateWith(), entries: [{ ...sampleEntry, m: 12 }] },
    });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded).toEqual(DEFAULT_STATE);
    expect(store.wasLastLoadCorrupt()).toBe(true);
    expect(store.lastLoadIssue()).toBe('corrupt');
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('stashes transactions whose day is outside their persisted month', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...stateWith(), entries: [{ ...sampleEntry, y: 2026, m: 1, day: 31 }] },
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('stashes structurally invalid top-level fields before using defaults', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...stateWith(), totalBudget: 'not a number' },
    });
    const store = createStore(createMemoryPersistence(blob));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(await store.readCorruptStash()).toBe(blob);
  });

  it('writes a versioned envelope, not the bare state', async () => {
    let written: string | null = null;
    const store = createStore({
      read: async () => written,
      write: async (value) => {
        written = value;
      },
      readCorruptStash: async () => null,
      writeCorruptStash: async () => {},
    });

    const state = stateWith({ theme: 'dark' });
    await store.save(state);

    expect(JSON.parse(written!)).toEqual({ version: SCHEMA_VERSION, state });
  });

  it('serializes whole-state saves so an earlier delayed write cannot overwrite a newer state', async () => {
    let durable: string | null = null;
    const pending: { value: string; resolve: () => void }[] = [];
    const store = createStore({
      read: async () => durable,
      write: (value) =>
        new Promise<void>((resolve) => {
          pending.push({
            value,
            resolve: () => {
              durable = value;
              resolve();
            },
          });
        }),
      readCorruptStash: async () => null,
      writeCorruptStash: async () => {},
    });

    const first = store.save(stateWith({ theme: 'light' }));
    const second = store.save(stateWith({ theme: 'dark' }));

    await Promise.resolve();
    expect(pending).toHaveLength(1);
    expect(JSON.parse(pending[0].value).state.theme).toBe('light');

    pending[0].resolve();
    await first;
    await Promise.resolve();

    expect(pending).toHaveLength(2);
    expect(JSON.parse(pending[1].value).state.theme).toBe('dark');

    pending[1].resolve();
    await second;
    expect(JSON.parse(durable!).state.theme).toBe('dark');
  });
});

describe('createStore — corrupt-load safety net (#28)', () => {
  it('stashes a byte-identical copy of a garbled blob before degrading to defaults', async () => {
    const garbled = '{not valid json';
    const store = createStore(createMemoryPersistence(garbled));

    const loaded = await store.load();

    expect(loaded).toEqual(DEFAULT_STATE);
    expect(store.wasLastLoadCorrupt()).toBe(true);
    expect(await store.hasCorruptStash()).toBe(true);
    expect(await store.readCorruptStash()).toBe(garbled);
  });

  it('stashes a byte-identical copy of a version-mismatched blob before degrading to defaults', async () => {
    const stale = JSON.stringify({
      version: SCHEMA_VERSION + 1,
      state: stateWith({ theme: 'light' }),
    });
    const store = createStore(createMemoryPersistence(stale));

    const loaded = await store.load();

    expect(loaded).toEqual(DEFAULT_STATE);
    expect(store.wasLastLoadCorrupt()).toBe(true);
    expect(await store.readCorruptStash()).toBe(stale);
  });

  it('leaves no stash after a healthy load', async () => {
    const blob = JSON.stringify({ version: SCHEMA_VERSION, state: stateWith({ theme: 'light' }) });
    const store = createStore(createMemoryPersistence(blob));

    await store.load();

    expect(store.wasLastLoadCorrupt()).toBe(false);
    expect(await store.hasCorruptStash()).toBe(false);
    expect(await store.readCorruptStash()).toBeNull();
  });

  it('leaves no stash when nothing was persisted (first launch, not a corrupt load)', async () => {
    const store = createStore(createMemoryPersistence(null));

    await store.load();

    expect(store.wasLastLoadCorrupt()).toBe(false);
    expect(await store.hasCorruptStash()).toBe(false);
  });

  it('never overwrites an existing stash on a subsequent save', async () => {
    const garbled = '{not valid json';
    const store = createStore(createMemoryPersistence(garbled));

    await store.load();
    await store.save(stateWith({ theme: 'light' }));
    await store.save(stateWith({ theme: 'dark' }));

    expect(await store.readCorruptStash()).toBe(garbled);
  });

  it('a later healthy boot no longer reports the notice, even though the stash persists', async () => {
    // Boot 1: corrupt load stashes the blob and reports it via wasLastLoadCorrupt().
    const persistence = createMemoryPersistence('{not valid json');
    const firstBoot = createStore(persistence);
    await firstBoot.load();
    expect(firstBoot.wasLastLoadCorrupt()).toBe(true);

    // The app saves the recovered (default) state, overwriting the primary key
    // with a valid blob — simulating normal use after the corrupt boot.
    await firstBoot.save(DEFAULT_STATE);

    // Boot 2 (a fresh Store instance, as on a real app relaunch): the primary
    // blob is now healthy, so no new notice — but the stash from boot 1 is
    // untouched, so recovery is still offered.
    const secondBoot = createStore(persistence);
    await secondBoot.load();

    expect(secondBoot.wasLastLoadCorrupt()).toBe(false);
    expect(await secondBoot.hasCorruptStash()).toBe(true);
  });

  it('reports a read failure without crashing or claiming a corrupt stash', async () => {
    const store = createStore({
      read: async () => {
        throw new Error('storage unavailable');
      },
      write: async () => {},
      readCorruptStash: async () => null,
      writeCorruptStash: async () => {},
    });

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(store.wasLastLoadCorrupt()).toBe(false);
    expect(store.lastLoadIssue()).toBe('read-failed');
  });

  it('reports when an invalid blob cannot be stashed for recovery', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...stateWith(), entries: [{ ...sampleEntry, amount: '850' }] },
    });
    const store = createStore({
      read: async () => blob,
      write: async () => {},
      readCorruptStash: async () => null,
      writeCorruptStash: async () => {
        throw new Error('stash unavailable');
      },
    });

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
    expect(store.wasLastLoadCorrupt()).toBe(false);
    expect(store.lastLoadIssue()).toBe('recovery-failed');
  });
});
