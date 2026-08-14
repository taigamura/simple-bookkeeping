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
}

/** Single key holding the whole-state JSON envelope. */
const STORAGE_KEY = 'kaji:state:v1';
/** Second key holding the last unreadable blob, kept for recovery (#28). */
const CORRUPT_STASH_KEY = 'kaji:state:v1:corrupt-stash';

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
};

/**
 * In-memory `Persistence` for tests and previews — no AsyncStorage required.
 * Because the seam is this small, a store round-trip test needs only this.
 */
export function createMemoryPersistence(initial: string | null = null): Persistence {
  let value = initial;
  let stash: string | null = null;
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
      return pairs;
    },
  };
}
