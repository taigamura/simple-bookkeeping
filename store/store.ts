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
}

export function createStore(
  persistence: Persistence = asyncStoragePersistence,
): Store {
  return {
    async load() {
      try {
        const raw = await persistence.read();
        if (!raw) return { ...DEFAULT_STATE };
        const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>;
        if (envelope.version !== SCHEMA_VERSION || !envelope.state) {
          return { ...DEFAULT_STATE };
        }
        // Merge so missing fields fall back and unknown fields are dropped.
        return { ...DEFAULT_STATE, ...envelope.state };
      } catch {
        return { ...DEFAULT_STATE };
      }
    },
    async save(state) {
      const envelope: PersistedEnvelope = { version: SCHEMA_VERSION, state };
      await persistence.write(JSON.stringify(envelope));
    },
  };
}
