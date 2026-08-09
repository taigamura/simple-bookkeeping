/**
 * Full-fidelity local household backup and restore (#114).
 *
 * This is the lossless counterpart to the portable transaction CSV, and the two
 * are deliberately different artifacts:
 *
 * - The CSV (`zaim.ts`, the Settings "Export data" row) is a *portable, lossy*
 *   interchange format. It carries one line per transaction so another app can
 *   read it, and it drops recurrence rules, budgets, tombstones, attribution,
 *   and every piece of sync metadata.
 * - The backup below is a *full-fidelity, app-private* JSON file. It restores a
 *   household exactly as it was, including the metadata two replicas need in
 *   order to keep converging: version vectors, the applied-operation replay
 *   fence, tombstones, attribution, and history.
 *
 * A backup is not a recovery pack. The recovery pack (`recoveryPack.ts`) is the
 * encrypted, passphrase-protected artifact that carries household *key
 * material*; a backup never contains a key, a passphrase, or a pairing
 * invitation, so it can be written to the user's own file store as plain JSON.
 *
 * Device-local preferences are excluded on purpose — see
 * `HOUSEHOLD_BACKUP_EXCLUDED_FIELDS`. Restoring a household onto a phone must
 * not silently repaint that phone's theme, motion, calendar, or category order.
 */
import { isJsonSafe } from './jsonSafe';
import {
  isHouseholdConfigState,
  isRecurrenceSyncState,
  isSyncState,
  type HouseholdConfigState,
  type HouseholdId,
  type RecurrenceSyncState,
  type SyncState,
} from './sync';
import type { HouseholdState } from '../store/schema';

export const HOUSEHOLD_BACKUP_FORMAT = 'kaji.household-backup';
/** Bump only for an incompatible payload change; older versions stay readable. */
export const HOUSEHOLD_BACKUP_VERSION = 1;
export const HOUSEHOLD_BACKUP_MIN_VERSION = 1;
/** Generous ceiling: a decade of daily entries is far under this. */
const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

/**
 * Device-local state a backup never carries, documented so the exclusion is a
 * stated contract rather than an accident of the payload shape.
 */
export const HOUSEHOLD_BACKUP_EXCLUDED_FIELDS = [
  'device',
  'theme',
  'motion',
  'calendarView',
  'summaryGranularity',
  'budgetMode',
  'totalBudget',
  'expenseCategoryOrder',
  'incomeCategoryOrder',
] as const;

export interface HouseholdBackupPayload {
  /** The replicated ledger: entries, recurrence rules, categories, budgets, currency. */
  household: HouseholdState;
  /** Transaction sync metadata: vectors, replay fence, tombstones, attribution, history. */
  sync: SyncState;
  /** Present once the household has replicated configuration. */
  config?: HouseholdConfigState;
  /** Present once the household has replicated recurrence rules. */
  recurrence?: RecurrenceSyncState;
}

export interface HouseholdBackup {
  format: typeof HOUSEHOLD_BACKUP_FORMAT;
  version: number;
  householdId: HouseholdId;
  createdAt: string;
  payload: HouseholdBackupPayload;
}

/** Counts a restore confirmation can show before anything is written. */
export interface HouseholdBackupPreview {
  householdId: HouseholdId;
  createdAt: string;
  version: number;
  entries: number;
  recurrenceRules: number;
  categories: number;
  budgets: number;
  tombstones: number;
  attributed: number;
  historyEntries: number;
  appliedOperations: number;
  includesConfig: boolean;
  includesRecurrence: boolean;
}

export interface HouseholdBackupStore {
  load(): Promise<HouseholdBackupPayload>;
  save(payload: HouseholdBackupPayload): Promise<void>;
}

export interface HouseholdBackupRestore {
  payload: HouseholdBackupPayload;
  preview: HouseholdBackupPreview;
  /** Put the pre-restore household back, byte for byte. */
  rollback(): Promise<void>;
}

export type HouseholdBackupFailure =
  | 'invalid-backup'
  | 'unsupported-version'
  | 'wrong-household'
  | 'restore-failed';

export class HouseholdBackupError extends Error {
  readonly code: HouseholdBackupFailure;

  constructor(code: HouseholdBackupFailure) {
    super(code);
    this.name = 'HouseholdBackupError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

/**
 * Rebuild the payload in a fixed key order from validated fields. Unknown keys
 * — including any device-local slice someone appended by hand — are dropped
 * here rather than being carried into the restored household.
 */
function stagePayload(value: unknown): HouseholdBackupPayload {
  if (!isRecord(value) || !isJsonSafe(value)) throw new HouseholdBackupError('invalid-backup');
  // Resolve lazily: store/schema imports the domain barrel for its field
  // validators, and this module is itself exported by that barrel.
  const { normalizeHouseholdState } = require('../store/schema') as {
    normalizeHouseholdState(value: unknown): HouseholdState | null;
  };
  const household = normalizeHouseholdState(value.household);
  if (!household || !isSyncState(value.sync)) throw new HouseholdBackupError('invalid-backup');
  if (value.config !== undefined && !isHouseholdConfigState(value.config)) {
    throw new HouseholdBackupError('invalid-backup');
  }
  if (value.recurrence !== undefined && !isRecurrenceSyncState(value.recurrence)) {
    throw new HouseholdBackupError('invalid-backup');
  }
  const sync = value.sync;
  const config = value.config as HouseholdConfigState | undefined;
  const recurrence = value.recurrence as RecurrenceSyncState | undefined;
  // One household per file. A pack that mixes identities cannot be restored
  // into either of them without corrupting attribution.
  if ((config && config.householdId !== sync.householdId)
    || (recurrence && recurrence.householdId !== sync.householdId)) {
    throw new HouseholdBackupError('wrong-household');
  }
  return {
    household,
    sync: clone(sync),
    ...(config ? { config: clone(config) } : {}),
    ...(recurrence ? { recurrence: clone(recurrence) } : {}),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function previewOf(backup: HouseholdBackup): HouseholdBackupPreview {
  const { household, sync, config, recurrence } = backup.payload;
  return {
    householdId: backup.householdId,
    createdAt: backup.createdAt,
    version: backup.version,
    entries: household.entries.length,
    recurrenceRules: household.recurrenceRules.length,
    categories: household.categories.length,
    budgets: Object.keys(household.budgets).length,
    tombstones: Object.keys(sync.tombstones).length,
    attributed: Object.keys(sync.attribution).length,
    historyEntries: Object.values(sync.history).reduce((total, entries) => total + entries.length, 0),
    appliedOperations: sync.appliedOperations.length,
    includesConfig: config !== undefined,
    includesRecurrence: recurrence !== undefined,
  };
}

/**
 * Serialize a household to a backup file. Validation runs before anything is
 * written, so an unserializable or cross-household payload fails loudly instead
 * of producing a file that cannot be restored.
 */
export function createHouseholdBackup(
  payload: HouseholdBackupPayload,
  options: { createdAt?: string } = {},
): string {
  const staged = stagePayload(payload);
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (!isTimestamp(createdAt)) throw new HouseholdBackupError('invalid-backup');
  const backup: HouseholdBackup = {
    format: HOUSEHOLD_BACKUP_FORMAT,
    version: HOUSEHOLD_BACKUP_VERSION,
    householdId: staged.sync.householdId,
    createdAt,
    payload: staged,
  };
  return JSON.stringify(backup);
}

/**
 * Parse and fully validate a backup file. A file written by a newer app is
 * rejected rather than partially understood — dropping fields we cannot read
 * would silently discard household data.
 */
export function readHouseholdBackup(
  text: string,
  options: { householdId?: HouseholdId } = {},
): HouseholdBackup {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BACKUP_BYTES) {
    throw new HouseholdBackupError('invalid-backup');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new HouseholdBackupError('invalid-backup'); }
  if (!isRecord(parsed) || parsed.format !== HOUSEHOLD_BACKUP_FORMAT) {
    throw new HouseholdBackupError('invalid-backup');
  }
  const version = parsed.version;
  if (typeof version !== 'number' || !Number.isInteger(version)
    || version < HOUSEHOLD_BACKUP_MIN_VERSION || version > HOUSEHOLD_BACKUP_VERSION) {
    throw new HouseholdBackupError('unsupported-version');
  }
  if (!isTimestamp(parsed.createdAt)) throw new HouseholdBackupError('invalid-backup');
  const payload = stagePayload(parsed.payload);
  if (parsed.householdId !== payload.sync.householdId) {
    throw new HouseholdBackupError('wrong-household');
  }
  if (options.householdId !== undefined && options.householdId !== payload.sync.householdId) {
    throw new HouseholdBackupError('wrong-household');
  }
  return {
    format: HOUSEHOLD_BACKUP_FORMAT,
    version,
    householdId: payload.sync.householdId,
    createdAt: parsed.createdAt,
    payload,
  };
}

/** Validate a file and describe what a restore would bring in, writing nothing. */
export function previewHouseholdBackup(
  text: string,
  options: { householdId?: HouseholdId } = {},
): HouseholdBackupPreview {
  return previewOf(readHouseholdBackup(text, options));
}

/**
 * Stage, validate, preview, then commit. The prior household is read before the
 * write and put back if the write fails, so a failed restore never leaves a
 * half-replaced household behind. The returned `rollback` lets the caller undo a
 * restore that succeeded but was not what the user wanted.
 */
export async function restoreHouseholdBackup(
  store: HouseholdBackupStore,
  text: string,
  options: { householdId?: HouseholdId } = {},
): Promise<HouseholdBackupRestore> {
  const backup = readHouseholdBackup(text, options);
  const checkpoint = await store.load();
  try {
    await store.save(backup.payload);
  } catch {
    try { await store.save(checkpoint); } catch { /* preserve the original failure */ }
    throw new HouseholdBackupError('restore-failed');
  }
  return {
    payload: backup.payload,
    preview: previewOf(backup),
    rollback: () => store.save(checkpoint),
  };
}
