/**
 * The whole persisted app state — a single JSON blob (decision 4: AsyncStorage
 * whole-state JSON, no SQLite yet). This is the one source of truth the store
 * loads on boot and rewrites on change.
 *
 * Fields grow slice by slice. `entries` is the ledger; `expCats`/`incCats` are
 * seeded with defaults on first launch (decision 8 — empty ledger, categories
 * only). `currency`/`premium` arrive with their slices (#7/#8); because the
 * store merges by known keys, adding a field later is backward-compatible.
 */
import { DEFAULT_EXP_CATS, DEFAULT_INC_CATS, DEFAULT_CURRENCY } from '../domain';
import type { Budgets, Currency, Transaction } from '../domain';
import type { ThemeMode } from '../theme/tokens';

/** Bump when the shape changes incompatibly; `load()` falls back to defaults. */
export const SCHEMA_VERSION = 1;

export interface AppState {
  theme: ThemeMode;
  entries: Transaction[];
  expCats: string[];
  incCats: string[];
  currency: Currency;
  premium: boolean;
  /** Face ID / passcode gate on launch (#30); default off, web never gates. */
  lockEnabled: boolean;
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
  /** What the app opens to on launch (#68): 'calendar' for Calendar, 'entry' for Entry sheet.
   *  Added after v1 blobs shipped — merge-by-known-keys load fills with the default. */
  openTo: 'calendar' | 'entry';
}

export const DEFAULT_STATE: AppState = {
  theme: 'dark',
  entries: [],
  expCats: DEFAULT_EXP_CATS,
  incCats: DEFAULT_INC_CATS,
  currency: DEFAULT_CURRENCY,
  premium: false,
  lockEnabled: false,
  budgets: {},
  budgetMode: 'category',
  totalBudget: 0,
  openTo: 'calendar',
};

/** On-disk envelope: the state plus a version tag for future migrations. */
export interface PersistedEnvelope {
  version: number;
  state: AppState;
}
