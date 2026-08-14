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

/** How many rolling backups to keep. Each holds a full state envelope, so only
 *  the newest non-empty one is ever needed to recover; the rest are history. */
const SNAPSHOT_LIMIT = 5;

export interface Store {
  /** Read persisted state, or defaults if absent/corrupt. Never rejects. */
  load(): Promise<AppState>;
  /** Persist the whole state as a versioned JSON envelope. */
  save(state: AppState): Promise<void>;
  /** Whether the most recent `load()` call stashed an unreadable blob (#28) —
   *  drives the one-time boot notice; `false` on a healthy or empty load. */
  wasLastLoadCorrupt(): boolean;
  /** Whether the most recent `load()` recovered the ledger from a local backup
   *  because the primary key was missing or unreadable — drives a one-time
   *  "restored from a backup" notice. */
  wasLastLoadRestored(): boolean;
  /** The most recent `load()` outcome, for localized recovery guidance. */
  lastLoadIssue(): LoadIssue;
  /** Whether a corrupt-stash blob currently exists, from this boot or a past one. */
  hasCorruptStash(): Promise<boolean>;
  /** The stashed raw blob, or `null` if none exists. */
  readCorruptStash(): Promise<string | null>;
  /** Pretty-printed JSON of every key/value in storage, for the recovery
   *  export — surfaces a ledger left under a superseded storage key. */
  dumpStorage(): Promise<string>;
  /** Drop every rolling backup — called when the user intentionally wipes the
   *  ledger, so the auto-restore can't later resurrect the deleted data. */
  clearSnapshots(): Promise<void>;
}

export function createStore(
  persistence: Persistence = asyncStoragePersistence,
): Store {
  let lastLoadCorrupt = false;
  let lastLoadRestored = false;
  let lastLoadIssue: LoadIssue = 'none';
  let saveQueue: Promise<void> = Promise.resolve();
  // The last envelope backed up, kept in memory to skip redundant snapshot
  // writes on no-op saves without re-reading the newest snapshot each time.
  let lastSnapshotJson: string | null = null;
  // The entries array last backed up. The app updates immutably, so a new
  // reference means the ledger actually changed — this skips re-snapshotting a
  // (possibly large) ledger on non-ledger saves like a theme or currency toggle.
  let lastSnapshotEntries: AppState['entries'] | null = null;
  let snapshotSeq = 0;

  // Roll a backup of the just-saved envelope. Empty ledgers are never backed up
  // (nothing to protect, and it keeps a wipe out of the history the restore
  // reads from). Best-effort: a backup failure must never fail the save.
  async function snapshot(json: string, entryCount: number): Promise<void> {
    if (entryCount <= 0 || json === lastSnapshotJson) return;
    if (!persistence.writeSnapshot || !persistence.snapshotIds || !persistence.deleteSnapshot) return;
    try {
      // 13-digit ms + zero-padded seq keeps ids lexically sortable = chronological.
      const id = `${Date.now()}-${String(snapshotSeq++).padStart(6, '0')}`;
      await persistence.writeSnapshot(id, json);
      lastSnapshotJson = json;
      const ids = (await persistence.snapshotIds()).sort(); // oldest first
      for (let i = 0; i < ids.length - SNAPSHOT_LIMIT; i++) {
        await persistence.deleteSnapshot(ids[i]);
      }
    } catch {
      // Backups are advisory; swallow so the primary write still counts.
    }
  }

  // The most recent backup that holds a non-empty, valid ledger, or null.
  async function newestValidSnapshot(): Promise<AppState | null> {
    if (!persistence.snapshotIds || !persistence.readSnapshot) return null;
    try {
      const ids = (await persistence.snapshotIds()).sort().reverse(); // newest first
      for (const id of ids) {
        const raw = await persistence.readSnapshot(id);
        if (!raw) continue;
        try {
          const env = JSON.parse(raw) as Partial<PersistedEnvelope>;
          if (env.version !== SCHEMA_VERSION || !env.state) continue;
          const normalized = normalizePersistedState(env.state);
          if (normalized && normalized.entries.length > 0) return normalized;
        } catch {
          // Skip an unreadable snapshot; try the next-newest.
        }
      }
    } catch {
      // Snapshot store unavailable — fall through to defaults.
    }
    return null;
  }

  // Reached only when the primary ledger is genuinely missing or unreadable (a
  // valid-but-empty ledger is respected, never overwritten — that could be an
  // intentional delete). Bring back the newest backup and rewrite it to the
  // primary key so the session continues from it.
  async function restoreOrDefault(): Promise<AppState> {
    const restored = await newestValidSnapshot();
    if (!restored) return { ...DEFAULT_STATE };
    try {
      await persistence.write(JSON.stringify({ version: SCHEMA_VERSION, state: restored }));
    } catch {
      // Even if the rewrite fails, hand the restored state to the session.
    }
    lastLoadRestored = true;
    return restored;
  }

  // Stash the raw blob load() couldn't use, then try a backup before defaults,
  // so a bad blob is recoverable and a wiped primary self-heals.
  async function stashAndRecover(raw: string): Promise<AppState> {
    try {
      await persistence.writeCorruptStash(raw);
      lastLoadCorrupt = true;
      lastLoadIssue = 'corrupt';
    } catch {
      lastLoadIssue = 'recovery-failed';
    }
    return await restoreOrDefault();
  }

  return {
    async load() {
      lastLoadCorrupt = false;
      lastLoadRestored = false;
      lastLoadIssue = 'none';

      let raw: string | null;
      try {
        raw = await persistence.read();
      } catch {
        // A transient primary read failure is NOT a wipe — the primary may be
        // fine next boot, so do not overwrite it with an older backup here.
        lastLoadIssue = 'read-failed';
        return { ...DEFAULT_STATE };
      }
      if (!raw) return await restoreOrDefault();

      try {
        const envelope = JSON.parse(raw) as Partial<PersistedEnvelope>;
        if (envelope.version !== SCHEMA_VERSION || !envelope.state) {
          return await stashAndRecover(raw);
        }
        const normalized = normalizePersistedState(envelope.state);
        if (!normalized) return await stashAndRecover(raw);
        return normalized;
      } catch {
        return await stashAndRecover(raw);
      }
    },
    async save(state) {
      const json = JSON.stringify({ version: SCHEMA_VERSION, state } as PersistedEnvelope);
      const write = () => persistence.write(json);
      saveQueue = saveQueue.then(write, write);
      await saveQueue;
      if (state.entries !== lastSnapshotEntries) {
        lastSnapshotEntries = state.entries;
        await snapshot(json, state.entries.length);
      }
    },
    wasLastLoadCorrupt: () => lastLoadCorrupt,
    wasLastLoadRestored: () => lastLoadRestored,
    lastLoadIssue: () => lastLoadIssue,
    hasCorruptStash: async () => (await persistence.readCorruptStash()) !== null,
    readCorruptStash: () => persistence.readCorruptStash(),
    dumpStorage: async () => {
      const pairs = (await persistence.dumpAll?.()) ?? [];
      return JSON.stringify(Object.fromEntries(pairs), null, 2);
    },
    clearSnapshots: async () => {
      lastSnapshotJson = null;
      lastSnapshotEntries = null;
      if (!persistence.snapshotIds || !persistence.deleteSnapshot) return;
      try {
        const ids = await persistence.snapshotIds();
        for (const id of ids) await persistence.deleteSnapshot(id);
      } catch {
        // Best-effort; a failed clear only risks a later restore prompt.
      }
    },
  };
}
