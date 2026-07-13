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
import type { Transaction } from '../domain';

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
  type: 'expense',
  amount: 850,
  category: 'Food',
  note: 'Food',
  repeat: 'never',
};

describe('createStore', () => {
  it('round-trips saved state: save then load returns the persisted theme', async () => {
    const store = createStore(createMemoryPersistence());

    await store.save(stateWith({ theme: 'light' }));

    expect((await store.load()).theme).toBe('light');
  });

  it('round-trips the ledger: saved entries survive a reload', async () => {
    const store = createStore(createMemoryPersistence());

    await store.save(stateWith({ entries: [sampleEntry] }));

    expect((await store.load()).entries).toEqual([sampleEntry]);
  });

  it('round-trips lockEnabled (#30): saved true survives a reload', async () => {
    const store = createStore(createMemoryPersistence());

    await store.save(stateWith({ lockEnabled: true }));

    expect((await store.load()).lockEnabled).toBe(true);
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
      lockEnabled: _lockEnabled,
      budgets: _budgets,
      budgetMode: _budgetMode,
      totalBudget: _totalBudget,
      openTo: _openTo,
      ...legacyState
    } = stateWith({ entries: [sampleEntry], theme: 'light' });
    const blob = JSON.stringify({ version: SCHEMA_VERSION, state: legacyState });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded.entries).toEqual([sampleEntry]);
    expect(loaded.theme).toBe('light');
    expect(loaded.currency).toEqual(DEFAULT_STATE.currency);
    expect(loaded.lockEnabled).toBe(false);
    expect(loaded.budgets).toEqual({});
    expect(loaded.budgetMode).toBe('category');
    expect(loaded.totalBudget).toBe(0);
    expect(loaded.openTo).toBe('calendar');
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
