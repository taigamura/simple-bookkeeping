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

  it('merges persisted state over defaults: drops unknown, fills missing fields', async () => {
    // Persist only `theme` (+ an unknown field); the rest should fill from defaults.
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { theme: 'light', bogus: 42 },
    });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded).toEqual(stateWith({ theme: 'light' })); // missing filled, unknown dropped
    expect(loaded).not.toHaveProperty('bogus');
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
});
