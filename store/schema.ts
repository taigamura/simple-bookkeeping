/**
 * The whole persisted app state — a single JSON blob (decision 4: AsyncStorage
 * whole-state JSON, no SQLite yet). This is the one source of truth the store
 * loads on boot and rewrites on change.
 *
 * Fields grow slice by slice. `entries` is the ledger; `expCats`/`incCats` are
 * seeded with defaults on first launch (decision 8 — empty ledger, categories
 * only). The store merges by known keys, so adding a field later is
 * backward-compatible and legacy fields are ignored on load.
 */
import {
  CURRENCIES,
  DEFAULT_EXP_CATS,
  DEFAULT_INC_CATS,
  DEFAULT_CURRENCY,
  daysInMonth,
} from '../domain';
import type {
  Budgets,
  Currency,
  RecurrenceDate,
  RecurrenceRule,
  Repeat,
  Transaction,
  TxType,
  WeekendShift,
} from '../domain';
import type { ThemeMode } from '../theme/tokens';

/** Bump when the shape changes incompatibly; `load()` falls back to defaults. */
export const SCHEMA_VERSION = 1;

export interface AppState {
  theme: ThemeMode;
  entries: Transaction[];
  /** Infinite recurrence definitions; concrete occurrences are projected on demand. */
  recurrenceRules: RecurrenceRule[];
  expCats: string[];
  incCats: string[];
  currency: Currency;
  /** Recurring monthly budget per expense category (#49); absent = no budget.
   *  Added after v1 blobs shipped — the merge-by-known-keys load fills it with
   *  the empty default, so no schema version bump. */
  budgets: Budgets;
  /** Budget mode (#66): 'category' for per-category, 'total' for a single monthly amount.
   *  Added after v1 blobs shipped — merge-by-known-keys load fills with the default. */
  budgetMode: 'category' | 'total';
  /** Total monthly budget amount in total mode (#66); 0 = no total budget.
   *  Added after v1 blobs shipped — merge-by-known-keys load fills with the default. */
  totalBudget: number;
}

export const DEFAULT_STATE: AppState = {
  theme: 'dark',
  entries: [],
  recurrenceRules: [],
  expCats: DEFAULT_EXP_CATS,
  incCats: DEFAULT_INC_CATS,
  currency: DEFAULT_CURRENCY,
  budgets: {},
  budgetMode: 'category',
  totalBudget: 0,
};

/** On-disk envelope: the state plus a version tag for future migrations. */
export interface PersistedEnvelope {
  version: number;
  state: AppState;
}

type StateKey = keyof AppState;

const stateKeys = Object.keys(DEFAULT_STATE) as StateKey[];
const additiveStateKeys: StateKey[] = [
  'recurrenceRules',
  'currency',
  'budgets',
  'budgetMode',
  'totalBudget',
];
const txTypes: TxType[] = ['income', 'expense'];
const repeats: Repeat[] = ['never', 'daily', 'monthly', 'yearly'];
const recurringRepeats: RecurrenceRule['repeat'][] = ['daily', 'monthly', 'yearly'];
const weekendShifts: WeekendShift[] = ['after', 'before', 'off'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isCategoryArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  );
}

function isCurrency(value: unknown): value is Currency {
  return (
    isRecord(value) &&
    typeof value.symbol === 'string' &&
    typeof value.code === 'string' &&
    CURRENCIES.some(
      (currency) => currency.symbol === value.symbol && currency.code === value.code,
    )
  );
}

function isBudgets(value: unknown): value is Budgets {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (amount) => typeof amount === 'number' && Number.isFinite(amount) && amount > 0,
    )
  );
}

function normalizeDate(value: unknown): RecurrenceDate | null {
  if (!isRecord(value)) return null;
  if (!isInteger(value.y)) return null;
  if (!isInteger(value.m) || value.m < 0 || value.m > 11) return null;
  if (!isInteger(value.day) || value.day < 1 || value.day > daysInMonth(value.y, value.m)) {
    return null;
  }
  return { y: value.y, m: value.m, day: value.day };
}

const recurrenceKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRecurrenceKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = recurrenceKeyPattern.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const day = Number(match[3]);
  return m >= 0 && m <= 11 && day >= 1 && day <= daysInMonth(y, m);
}

function normalizeRecurrenceRule(value: unknown): RecurrenceRule | null {
  if (!isRecord(value)) return null;
  const start = normalizeDate(value.start);
  if (!start) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (!isInteger(value.anchorDay) || value.anchorDay < 1 || value.anchorDay > 31) return null;
  if (!txTypes.includes(value.type as TxType)) return null;
  if (!isInteger(value.amount) || value.amount <= 0) return null;
  if (typeof value.category !== 'string' || typeof value.note !== 'string') return null;
  if (!recurringRepeats.includes(value.repeat as RecurrenceRule['repeat'])) return null;
  if (!weekendShifts.includes(value.weekendShift as WeekendShift)) return null;
  if (
    !Array.isArray(value.exceptions) ||
    !value.exceptions.every(isRecurrenceKey)
  ) {
    return null;
  }
  if (
    value.endsBefore !== undefined &&
    !isRecurrenceKey(value.endsBefore)
  ) {
    return null;
  }
  const normalized: RecurrenceRule = {
    id: value.id,
    start,
    anchorDay: value.anchorDay,
    type: value.type as TxType,
    amount: value.amount,
    category: value.category,
    note: value.note,
    repeat: value.repeat as RecurrenceRule['repeat'],
    weekendShift: value.weekendShift as WeekendShift,
    exceptions: [...value.exceptions] as string[],
  };
  if (typeof value.endsBefore === 'string') normalized.endsBefore = value.endsBefore;
  return normalized;
}

function normalizeTransaction(value: unknown): Transaction | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (!isInteger(value.y)) return null;
  if (!isInteger(value.m) || value.m < 0 || value.m > 11) return null;
  if (!isInteger(value.day) || value.day < 1 || value.day > daysInMonth(value.y, value.m)) {
    return null;
  }
  if (!txTypes.includes(value.type as TxType)) return null;
  if (!isInteger(value.amount) || value.amount <= 0) return null;
  if (typeof value.category !== 'string') return null;
  if (typeof value.note !== 'string') return null;
  if (value.repeat !== undefined && !repeats.includes(value.repeat as Repeat)) return null;
  if (value.accountId !== undefined && typeof value.accountId !== 'string') return null;

  const normalized: Transaction = {
    id: value.id,
    y: value.y,
    m: value.m,
    day: value.day,
    type: value.type as TxType,
    amount: value.amount,
    category: value.category,
    note: value.note,
  };
  // Legacy materialized repeats have no series identity. Treat them as
  // one-time history rather than accidentally turning every old occurrence
  // into its own infinite rule.
  normalized.repeat = 'never';
  if (value.accountId !== undefined) normalized.accountId = value.accountId;
  return normalized;
}

function validateField(key: StateKey, value: unknown): boolean {
  switch (key) {
    case 'theme':
      return value === 'dark' || value === 'light';
    case 'entries':
      return Array.isArray(value) && value.every((item) => normalizeTransaction(item) !== null);
    case 'recurrenceRules':
      return Array.isArray(value) && value.every((item) => normalizeRecurrenceRule(item) !== null);
    case 'expCats':
    case 'incCats':
      return isCategoryArray(value);
    case 'currency':
      return isCurrency(value);
    case 'budgets':
      return isBudgets(value);
    case 'budgetMode':
      return value === 'category' || value === 'total';
    case 'totalBudget':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }
}

function normalizeField(key: StateKey, value: unknown): AppState[StateKey] | null {
  if (!validateField(key, value)) return null;
  if (key === 'entries') {
    return (value as unknown[]).map((item) => normalizeTransaction(item)!);
  }
  if (key === 'recurrenceRules') {
    return (value as unknown[]).map((item) => normalizeRecurrenceRule(item)!);
  }
  return value as AppState[StateKey];
}

/**
 * Validate and normalize a same-version persisted state.
 *
 * Older same-version blobs may omit additive fields; those are filled from
 * defaults. Unknown fields are discarded. Present-but-invalid fields reject the
 * whole state so `load()` can preserve the original raw blob for recovery.
 */
export function normalizePersistedState(value: unknown): AppState | null {
  if (!isRecord(value)) return null;

  const normalized: AppState = { ...DEFAULT_STATE };
  for (const key of stateKeys) {
    if (!(key in value)) {
      if (additiveStateKeys.includes(key)) continue;
      return null;
    }
    const field = value[key];
    const normalizedField = normalizeField(key, field);
    if (normalizedField === null) return null;
    (normalized as Record<StateKey, unknown>)[key] = normalizedField;
  }
  return normalized;
}
