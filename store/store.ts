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
  withIdentitySlices,
  type AppState,
  type PersistedEnvelope,
} from './schema';
import { reconcileQuickEntryCommands } from '../domain';

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
  queueQuickEntryCommand(command: unknown): Promise<void>;
  reconcileQuickEntryCommands(state: AppState): Promise<{ state: AppState; quarantined: number }>;
  readQuickEntryQuarantine(): Promise<string | null>;
}

export function createStore(
  persistence: Persistence = asyncStoragePersistence,
): Store {
  let lastLoadCorrupt = false;
  let lastLoadIssue: LoadIssue = 'none';
  let saveQueue: Promise<void> = Promise.resolve();
  const writeState = (state: AppState) => persistence.write(JSON.stringify({
    version: SCHEMA_VERSION,
    state: withIdentitySlices(state, false, true),
  }));
  const readQueue = async (): Promise<unknown[]> => {
    const raw = await persistence.readQuickEntryQueue?.();
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [raw];
    }
  };

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

  function hasLedgerData(state: AppState): boolean {
    return state.entries.length > 0 || state.recurrenceRules.length > 0;
  }

  function parsePersisted(raw: string): AppState | null {
    const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>;
    const legacyEnvelope = envelope.version === 1;
    if ((envelope.version !== SCHEMA_VERSION && !legacyEnvelope) || !envelope.state) return null;
    const normalized = normalizePersistedState(envelope.state);
    if (!normalized) return null;
    return withIdentitySlices(normalized, legacyEnvelope);
  }

  async function migrateActivePersisted(raw: string): Promise<AppState | null> {
    const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>;
    const legacyEnvelope = envelope.version === 1;
    if ((envelope.version !== SCHEMA_VERSION && !legacyEnvelope) || !envelope.state) return null;
    const normalized = normalizePersistedState(envelope.state);
    if (!normalized) return null;
    const migrated = withIdentitySlices(normalized, legacyEnvelope);
    if (legacyEnvelope) {
      // Persist the migration immediately so a second boot does not repeat
      // it, while leaving the original raw blob recoverable on failure.
      await persistence.write(JSON.stringify({ version: SCHEMA_VERSION, state: migrated }));
    }
    return migrated;
  }

  async function recoverReadableLegacy(): Promise<AppState | null> {
    const candidates = await persistence.readRecoveryCandidates?.();
    if (!candidates) return null;

    for (const candidate of candidates) {
      try {
        const recovered = parsePersisted(candidate);
        if (!recovered || !hasLedgerData(recovered)) continue;
        await persistence.write(JSON.stringify({
          version: SCHEMA_VERSION,
          state: withIdentitySlices(recovered, false, true),
        }));
        return recovered;
      } catch {
        // Bad recovery candidates stay untouched; the regular corrupt-stash
        // path is only for the active key the app tried to load.
      }
    }
    return null;
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
      if (!raw) return (await recoverReadableLegacy()) ?? { ...DEFAULT_STATE };

      try {
        const migrated = await migrateActivePersisted(raw);
        if (!migrated) return await stashAndDefault(raw);
        if (!hasLedgerData(migrated)) {
          const recovered = await recoverReadableLegacy();
          if (recovered) return recovered;
        }
        return migrated;
      } catch {
        return await stashAndDefault(raw);
      }
    },
    async save(state) {
      const envelope: PersistedEnvelope = { version: SCHEMA_VERSION, state: withIdentitySlices(state, false, true) };
      const write = () => persistence.write(JSON.stringify(envelope));
      saveQueue = saveQueue.then(write, write);
      await saveQueue;
    },
    wasLastLoadCorrupt: () => lastLoadCorrupt,
    lastLoadIssue: () => lastLoadIssue,
    hasCorruptStash: async () => (await persistence.readCorruptStash()) !== null,
    readCorruptStash: () => persistence.readCorruptStash(),
    async queueQuickEntryCommand(command) {
      const write = async () => {
        const queue = await readQueue();
        queue.push(command);
        await persistence.writeQuickEntryQueue?.(JSON.stringify(queue));
      };
      saveQueue = saveQueue.then(write, write);
      await saveQueue;
    },
    async reconcileQuickEntryCommands(state) {
      const write = async () => {
        const commands = await readQueue();
        const result = reconcileQuickEntryCommands(state.entries, commands);
        if (result.quarantined.length > 0) {
          const previousRaw = await persistence.readQuickEntryQuarantine?.();
          let previous: unknown[] = [];
          if (previousRaw) {
            try {
              const parsed: unknown = JSON.parse(previousRaw);
              previous = Array.isArray(parsed) ? parsed : [parsed];
            } catch { previous = [previousRaw]; }
          }
          await persistence.writeQuickEntryQuarantine?.(JSON.stringify([...previous, ...result.quarantined]));
        }
        if (result.applied.length > 0 || result.quarantined.length > 0) {
          const next = withIdentitySlices({ ...state, entries: result.entries }, false, true);
          await writeState(next);
          // Clear only after the household blob is durable. If the write
          // fails, the command remains available for the next boot/retry.
          await persistence.writeQuickEntryQueue?.(JSON.stringify([]));
          return { state: next, quarantined: result.quarantined.length };
        }
        return { state, quarantined: 0 };
      };
      let output: { state: AppState; quarantined: number } = { state, quarantined: 0 };
      const run = async () => { output = await write(); };
      saveQueue = saveQueue.then(run, run);
      await saveQueue;
      return output;
    },
    readQuickEntryQuarantine: () => persistence.readQuickEntryQuarantine?.() ?? Promise.resolve(null),
  };
}
