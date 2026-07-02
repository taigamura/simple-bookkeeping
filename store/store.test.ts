/**
 * Store round-trip + resilience tests (Foundation #2 acceptance criterion:
 * "saving then reloading state returns the persisted `theme`").
 *
 * Most cases drive the store through an in-memory `Persistence` — the store's
 * swap seam — so they assert the envelope/merge/degradation logic without any
 * native dependency. One case drives the *default* store, which talks to real
 * AsyncStorage (mocked in jest.setup.js), to prove that wiring round-trips too.
 */
import { createStore } from './store';
import { createMemoryPersistence } from './persistence';
import { DEFAULT_STATE, SCHEMA_VERSION } from './schema';

describe('createStore', () => {
  it('round-trips saved state: save then load returns the persisted theme', async () => {
    const store = createStore(createMemoryPersistence());

    await store.save({ theme: 'light' });

    expect(await store.load()).toEqual({ theme: 'light' });
  });

  it('round-trips through the default AsyncStorage-backed store', async () => {
    // No persistence arg → default asyncStoragePersistence (AsyncStorage mock).
    const store = createStore();

    await store.save({ theme: 'light' });

    expect(await store.load()).toEqual({ theme: 'light' });
  });

  it('returns defaults when nothing has been persisted', async () => {
    const store = createStore(createMemoryPersistence(null));

    expect(await store.load()).toEqual(DEFAULT_STATE);
  });

  it('degrades to defaults on corrupt JSON instead of throwing', async () => {
    const store = createStore(createMemoryPersistence('{not valid json'));

    await expect(store.load()).resolves.toEqual(DEFAULT_STATE);
  });

  it('degrades to defaults when the schema version does not match', async () => {
    const stale = JSON.stringify({
      version: SCHEMA_VERSION + 1,
      state: { theme: 'light' },
    });
    const store = createStore(createMemoryPersistence(stale));

    expect(await store.load()).toEqual(DEFAULT_STATE);
  });

  it('merges persisted state over defaults: drops unknown, fills missing fields', async () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { theme: 'light', bogus: 42 },
    });
    const store = createStore(createMemoryPersistence(blob));

    const loaded = await store.load();

    expect(loaded).toEqual({ theme: 'light' }); // known field kept, unknown dropped
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

    await store.save({ theme: 'dark' });

    expect(JSON.parse(written!)).toEqual({
      version: SCHEMA_VERSION,
      state: { theme: 'dark' },
    });
  });
});
