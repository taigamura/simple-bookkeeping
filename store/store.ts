/**
 * The store — the single seam UI talks to for durable state. It owns the
 * whole-state JSON contract: read the envelope on `load()`, rewrite it on
 * `save()`. Missing, corrupt, or version-mismatched data degrades to
 * `DEFAULT_STATE` rather than throwing, so a bad blob can never brick boot.
 *
 * Unknown persisted fields are dropped and missing ones are filled from
 * defaults (merge), which keeps old and new app versions interoperable.
 */
import { asyncStoragePersistence, type Persistence } from './persistence';
import {
  DEFAULT_STATE,
  SCHEMA_VERSION,
  normalizePersistedState,
  type AppState,
  type PersistedEnvelope,
} from './schema';

export type LoadIssue = 'none' | 'corrupt' | 'read-failed' | 'recovery-failed';

export interface Store {
  /** Read persisted state, or defaults if absent/corrupt. Never rejects. */
  load(): Promise<AppState>;
  /** Persist the whole state as a versioned JSON envelope. */
  save(state: AppState): Promise<void>;
  /** Whether the most recent `load()` call stashed an unreadable blob (#28) —
   *  drives the one-time boot notice; `false` on a healthy or empty load. */
  wasLastLoadCorrupt(): boolean;
  /** The most recent `load()` outcome, for localized recovery guidance. */
  lastLoadIssue(): LoadIssue;
  /** Whether a corrupt-stash blob currently exists, from this boot or a past one. */
  hasCorruptStash(): Promise<boolean>;
  /** The stashed raw blob, or `null` if none exists. */
  readCorruptStash(): Promise<string | null>;
}

export function createStore(
  persistence: Persistence = asyncStoragePersistence,
): Store {
  let lastLoadCorrupt = false;
  let lastLoadIssue: LoadIssue = 'none';
  let saveQueue: Promise<void> = Promise.resolve();

  // Stash the raw blob load() couldn't use before degrading to defaults, so a
  // bad blob is recoverable instead of silently lost on the next save.
  async function stashAndDefault(raw: string): Promise<AppState> {
    try {
      await persistence.writeCorruptStash(raw);
      lastLoadCorrupt = true;
      lastLoadIssue = 'corrupt';
    } catch {
      lastLoadIssue = 'recovery-failed';
    }
    return { ...DEFAULT_STATE };
  }

  return {
    async load() {
      lastLoadCorrupt = false;
      lastLoadIssue = 'none';

      let raw: string | null;
      try {
        raw = await persistence.read();
      } catch {
        lastLoadIssue = 'read-failed';
        return { ...DEFAULT_STATE };
      }
      if (!raw) return { ...DEFAULT_STATE };

      try {
        const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>;
        if (envelope.version !== SCHEMA_VERSION || !envelope.state) {
          return await stashAndDefault(raw);
        }
        const normalized = normalizePersistedState(envelope.state);
        if (!normalized) return await stashAndDefault(raw);
        return normalized;
      } catch {
        return await stashAndDefault(raw);
      }
    },
    async save(state) {
      const envelope: PersistedEnvelope = { version: SCHEMA_VERSION, state };
      const write = () => persistence.write(JSON.stringify(envelope));
      saveQueue = saveQueue.then(write, write);
      await saveQueue;
    },
    wasLastLoadCorrupt: () => lastLoadCorrupt,
    lastLoadIssue: () => lastLoadIssue,
    hasCorruptStash: async () => (await persistence.readCorruptStash()) !== null,
    readCorruptStash: () => persistence.readCorruptStash(),
  };
}
