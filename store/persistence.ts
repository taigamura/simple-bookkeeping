/**
 * The swap seam between the store and durable storage. Everything the store
 * needs is two calls — read the blob, write the blob — and nothing else. The
 * AsyncStorage adapter below is one implementation; a SQLite adapter (or an
 * in-memory fake for tests) can replace it without the store or UI changing.
 *
 * UI code must never import this directly — it talks to the store, the store
 * talks to a `Persistence`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Persistence {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  /** The raw blob `load()` couldn't parse/version-match, stashed before it
   *  fell back to defaults (#28) — `null` when nothing has been stashed. */
  readCorruptStash(): Promise<string | null>;
  writeCorruptStash(value: string): Promise<void>;
  /** Every key/value currently in storage, for the one-off recovery export —
   *  captures ledgers written under any past key (e.g. a build that moved to a
   *  new storage key and left the original behind). Optional so lightweight test
   *  fakes need not implement it. */
  dumpAll?(): Promise<Array<[string, string | null]>>;
  /** Rolling local backups keyed by id — the auto-restore safety net. Each holds
   *  a full state envelope; a reset/migration of the primary key can't touch
   *  them, so boot can fall back to the newest one. Optional for test fakes. */
  writeSnapshot?(id: string, value: string): Promise<void>;
  snapshotIds?(): Promise<string[]>;
  readSnapshot?(id: string): Promise<string | null>;
  deleteSnapshot?(id: string): Promise<void>;
}

/** Single key holding the whole-state JSON envelope. */
const STORAGE_KEY = 'kaji:state:v1';
/** Second key holding the last unreadable blob, kept for recovery (#28). */
const CORRUPT_STASH_KEY = 'kaji:state:v1:corrupt-stash';
/** Prefix for the rolling backup snapshots (`…:snapshot:<id>`). */
const SNAPSHOT_PREFIX = 'kaji:state:v1:snapshot:';

export const asyncStoragePersistence: Persistence = {
  read: () => AsyncStorage.getItem(STORAGE_KEY),
  write: (value) => AsyncStorage.setItem(STORAGE_KEY, value),
  readCorruptStash: () => AsyncStorage.getItem(CORRUPT_STASH_KEY),
  writeCorruptStash: (value) => AsyncStorage.setItem(CORRUPT_STASH_KEY, value),
  dumpAll: async () => {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs.map(([key, value]) => [key, value] as [string, string | null]);
  },
  writeSnapshot: (id, value) => AsyncStorage.setItem(SNAPSHOT_PREFIX + id, value),
  snapshotIds: async () =>
    (await AsyncStorage.getAllKeys())
      .filter((k) => k.startsWith(SNAPSHOT_PREFIX))
      .map((k) => k.slice(SNAPSHOT_PREFIX.length)),
  readSnapshot: (id) => AsyncStorage.getItem(SNAPSHOT_PREFIX + id),
  deleteSnapshot: (id) => AsyncStorage.removeItem(SNAPSHOT_PREFIX + id),
};

/**
 * In-memory `Persistence` for tests and previews — no AsyncStorage required.
 * Because the seam is this small, a store round-trip test needs only this.
 */
export function createMemoryPersistence(initial: string | null = null): Persistence {
  let value = initial;
  let stash: string | null = null;
  const snapshots = new Map<string, string>();
  return {
    read: async () => value,
    write: async (next) => {
      value = next;
    },
    readCorruptStash: async () => stash,
    writeCorruptStash: async (next) => {
      stash = next;
    },
    dumpAll: async () => {
      const pairs: Array<[string, string | null]> = [];
      if (value !== null) pairs.push(['kaji:state:v1', value]);
      if (stash !== null) pairs.push(['kaji:state:v1:corrupt-stash', stash]);
      for (const [id, v] of snapshots) pairs.push([`kaji:state:v1:snapshot:${id}`, v]);
      return pairs;
    },
    writeSnapshot: async (id, v) => {
      snapshots.set(id, v);
    },
    snapshotIds: async () => [...snapshots.keys()],
    readSnapshot: async (id) => snapshots.get(id) ?? null,
    deleteSnapshot: async (id) => {
      snapshots.delete(id);
    },
  };
}
