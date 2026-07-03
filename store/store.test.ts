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
    });

    const state = stateWith({ theme: 'dark' });
    await store.save(state);

    expect(JSON.parse(written!)).toEqual({ version: SCHEMA_VERSION, state });
  });
});
