/**
 * The whole persisted app state — a single JSON blob (decision: AsyncStorage
 * whole-state JSON, no SQLite yet). This is the one source of truth the store
 * loads on boot and rewrites on change.
 *
 * In this slice the only field is `theme`; later slices grow it (entries,
 * currency, categories, premium…). Keep it a plain serializable object so the
 * persistence layer can `JSON.stringify` it wholesale.
 */
import type { ThemeMode } from '../theme/tokens';

/** Bump when the shape changes incompatibly; `load()` falls back to defaults. */
export const SCHEMA_VERSION = 1;

export interface AppState {
  theme: ThemeMode;
}

export const DEFAULT_STATE: AppState = {
  theme: 'dark',
};

/** On-disk envelope: the state plus a version tag for future migrations. */
export interface PersistedEnvelope {
  version: number;
  state: AppState;
}
