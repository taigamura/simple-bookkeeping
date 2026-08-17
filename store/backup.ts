/**
 * Native full-ledger backup — the faithful, round-trippable counterpart to the
 * lossy Zaim CSV export (#24). The CSV flattens recurrence into concrete rows
 * and drops the rules; a backup carries the whole persisted state verbatim,
 * `recurrenceRules` included, so a restore brings repeats back as *rules* and
 * the app re-projects every past and future occurrence exactly as before.
 *
 * The file is the same versioned envelope the store writes to disk, so restore
 * reuses `normalizePersistedState` — the store's own load-time validator — as
 * its untrusted-input guard. No second schema, no second validator.
 */
import {
  SCHEMA_VERSION,
  normalizePersistedState,
  type AppState,
  type PersistedEnvelope,
} from './schema';

/** Serialize the whole app state to a backup file's text (pretty-printed for a
 *  human-inspectable file; the shape matches the on-disk persistence envelope). */
export function serializeBackup(state: AppState): string {
  const envelope: PersistedEnvelope = { version: SCHEMA_VERSION, state };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Parse a backup file's text back into a validated `AppState`, or `null` if it
 * is not a readable backup for this schema version. Every field is run through
 * `normalizePersistedState`, so a hand-edited or corrupt file can never restore
 * an invalid ledger — it is rejected wholesale.
 */
export function parseBackup(text: string): AppState | null {
  let envelope: Partial<PersistedEnvelope>;
  try {
    envelope = JSON.parse(text) as Partial<PersistedEnvelope>;
  } catch {
    return null;
  }
  if (envelope.version !== SCHEMA_VERSION || !envelope.state) return null;
  return normalizePersistedState(envelope.state);
}
