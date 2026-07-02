/**
 * Store public surface. UI imports from here — never from `persistence` or
 * AsyncStorage directly — so the durable-storage backend stays swappable.
 */
export { useStore, type UseStore } from './useStore';
export { createStore, type Store } from './store';
export {
  createMemoryPersistence,
  asyncStoragePersistence,
  type Persistence,
} from './persistence';
export {
  DEFAULT_STATE,
  SCHEMA_VERSION,
  type AppState,
  type PersistedEnvelope,
} from './schema';
