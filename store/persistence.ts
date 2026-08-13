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
import { Platform } from 'react-native';

export interface Persistence {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  /** The raw blob `load()` couldn't parse/version-match, stashed before it
   *  fell back to defaults (#28) — `null` when nothing has been stashed. */
  readCorruptStash(): Promise<string | null>;
  writeCorruptStash(value: string): Promise<void>;
}

/**
 * Single key holding the whole-state JSON envelope.
 *
 * iOS intentionally moves to a fresh key after the PR 122 rollback. TestFlight
 * devices may have a backup from the incompatible implementation under the old
 * key; loading that data into the reverted app is worse than starting clean.
 * Web and Android keep the old key so local dev/test data is not reset.
 */
const STORAGE_KEY = Platform.OS === 'ios' ? 'kaji:state:v2:ios-reset-20260813' : 'kaji:state:v1';
/** Second key holding the last unreadable blob, kept for recovery (#28). */
const CORRUPT_STASH_KEY =
  Platform.OS === 'ios'
    ? 'kaji:state:v2:ios-reset-20260813:corrupt-stash'
    : 'kaji:state:v1:corrupt-stash';

export const asyncStoragePersistence: Persistence = {
  read: () => AsyncStorage.getItem(STORAGE_KEY),
  write: (value) => AsyncStorage.setItem(STORAGE_KEY, value),
  readCorruptStash: () => AsyncStorage.getItem(CORRUPT_STASH_KEY),
  writeCorruptStash: (value) => AsyncStorage.setItem(CORRUPT_STASH_KEY, value),
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
  };
}
