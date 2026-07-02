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
import { DEFAULT_EXP_CATS, DEFAULT_INC_CATS } from '../domain';
import type { Transaction } from '../domain';
import type { ThemeMode } from '../theme/tokens';

/** Bump when the shape changes incompatibly; `load()` falls back to defaults. */
export const SCHEMA_VERSION = 1;

export interface AppState {
  theme: ThemeMode;
  entries: Transaction[];
  expCats: string[];
  incCats: string[];
}

export const DEFAULT_STATE: AppState = {
  theme: 'dark',
  entries: [],
  expCats: DEFAULT_EXP_CATS,
  incCats: DEFAULT_INC_CATS,
};

/** On-disk envelope: the state plus a version tag for future migrations. */
export interface PersistedEnvelope {
  version: number;
  state: AppState;
}
