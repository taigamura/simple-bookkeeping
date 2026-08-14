/**
 * React binding for the store: loads persisted state once on boot, then holds
 * it in component state and persists every change (save-on-change). Components
 * read `state` and call `update()` with a patch; the store handles the JSON and
 * the durable write.
 *
 * `ready` is false until the initial load resolves, so the root can hold render
 * (alongside the font gate) and avoid a dark→persisted-theme flash.
 */
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_STATE, type AppState } from './schema';
import { createStore, type LoadIssue, type Store } from './store';

const defaultStore = createStore();

export interface UseStore {
  ready: boolean;
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  /** True for the rest of this session if boot's load() stashed an unreadable
   *  blob (#28) — the root shows a one-time notice off this, not off
   *  `hasCorruptStash` (which stays true across later, healthy boots too). */
  showCorruptNotice: boolean;
  /** True for this session if boot restored the ledger from a rolling backup
   *  (the primary key was missing/unreadable) — drives a one-time notice. */
  showRestoredNotice: boolean;
  /** Whether a corrupt-stash blob exists, from this boot or a past one. */
  hasCorruptStash: boolean;
  /** Read the stashed raw blob for the "Export unreadable backup" row. */
  readCorruptStash: () => Promise<string | null>;
  /** Dump every storage key/value for the one-off "Recover data" export. */
  dumpStorage: () => Promise<string>;
  /** Drop the rolling backups — called on an intentional "Delete all data" so
   *  the auto-restore can't resurrect the wipe on the next boot. */
  clearSnapshots: () => Promise<void>;
  /** Non-corrupt persistence failures that need user-visible recovery guidance. */
  persistenceNotice: Exclude<LoadIssue, 'none' | 'corrupt'> | 'save-failed' | null;
}

export function useStore(store: Store = defaultStore): UseStore {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [showCorruptNotice, setShowCorruptNotice] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [hasCorruptStash, setHasCorruptStash] = useState(false);
  const [persistenceNotice, setPersistenceNotice] = useState<UseStore['persistenceNotice']>(null);

  useEffect(() => {
    let alive = true;
    store.load().then(async (loaded) => {
      const corrupt = store.wasLastLoadCorrupt();
      const restored = store.wasLastLoadRestored();
      const loadIssue = store.lastLoadIssue();
      let stashed = false;
      let stashReadFailed = false;
      try {
        stashed = await store.hasCorruptStash();
      } catch {
        stashReadFailed = true;
      }
      if (!alive) return;
      setState(loaded);
      setShowCorruptNotice(corrupt);
      setShowRestoredNotice(restored);
      setHasCorruptStash(stashed);
      setPersistenceNotice(
        stashReadFailed
          ? 'read-failed'
          : loadIssue === 'read-failed' || loadIssue === 'recovery-failed'
            ? loadIssue
            : null,
      );
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [store]);

  const update = useCallback(
    (patch: Partial<AppState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        void store.save(next).then(
          () => setPersistenceNotice((current) => (current === 'save-failed' ? null : current)),
          () => setPersistenceNotice('save-failed'),
        );
        return next;
      });
    },
    [store],
  );

  const readCorruptStash = useCallback(() => store.readCorruptStash(), [store]);
  const dumpStorage = useCallback(() => store.dumpStorage(), [store]);
  const clearSnapshots = useCallback(() => store.clearSnapshots(), [store]);

  return {
    ready,
    state,
    update,
    showCorruptNotice,
    showRestoredNotice,
    hasCorruptStash,
    readCorruptStash,
    dumpStorage,
    clearSnapshots,
    persistenceNotice,
  };
}
