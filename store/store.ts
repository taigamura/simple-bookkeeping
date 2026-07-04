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
  type AppState,
  type PersistedEnvelope,
} from './schema';

export interface Store {
  /** Read persisted state, or defaults if absent/corrupt. Never rejects. */
  load(): Promise<AppState>;
  /** Persist the whole state as a versioned JSON envelope. */
  save(state: AppState): Promise<void>;
  /** Whether the most recent `load()` call stashed an unreadable blob (#28) —
   *  drives the one-time boot notice; `false` on a healthy or empty load. */
  wasLastLoadCorrupt(): boolean;
  /** Whether a corrupt-stash blob currently exists, from this boot or a past one. */
  hasCorruptStash(): Promise<boolean>;
  /** The stashed raw blob, or `null` if none exists. */
  readCorruptStash(): Promise<string | null>;
}

export function createStore(
  persistence: Persistence = asyncStoragePersistence,
): Store {
  let lastLoadCorrupt = false;

  // Stash the raw blob load() couldn't use before degrading to defaults, so a
  // bad blob is recoverable instead of silently lost on the next save.
  async function stashAndDefault(raw: string): Promise<AppState> {
    await persistence.writeCorruptStash(raw);
    lastLoadCorrupt = true;
    return { ...DEFAULT_STATE };
  }

  return {
    async load() {
      lastLoadCorrupt = false;

      let raw: string | null;
      try {
        raw = await persistence.read();
      } catch {
        return { ...DEFAULT_STATE };
      }
      if (!raw) return { ...DEFAULT_STATE };

      try {
        const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>;
        if (envelope.version !== SCHEMA_VERSION || !envelope.state) {
          return await stashAndDefault(raw);
        }
        // Merge over defaults by *known* keys only: missing fields fall back to
        // defaults, and unknown persisted fields (e.g. from a newer schema) are
        // dropped so the loaded state never drifts from the AppState type.
        const persisted = envelope.state as Partial<AppState>;
        const merged = { ...DEFAULT_STATE };
        for (const key of Object.keys(DEFAULT_STATE) as (keyof AppState)[]) {
          const value = persisted[key];
          if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
        }
        return merged;
      } catch {
        return await stashAndDefault(raw);
      }
    },
    async save(state) {
      const envelope: PersistedEnvelope = { version: SCHEMA_VERSION, state };
      await persistence.write(JSON.stringify(envelope));
    },
    wasLastLoadCorrupt: () => lastLoadCorrupt,
    hasCorruptStash: async () => (await persistence.readCorruptStash()) !== null,
    readCorruptStash: () => persistence.readCorruptStash(),
  };
}
