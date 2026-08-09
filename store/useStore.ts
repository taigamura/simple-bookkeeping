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

import { DEFAULT_STATE, withIdentitySlices, type AppState } from './schema';
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
  /** Whether a corrupt-stash blob exists, from this boot or a past one. */
  hasCorruptStash: boolean;
  /** Read the stashed raw blob for the "Export unreadable backup" row. */
  readCorruptStash: () => Promise<string | null>;
  /** Non-corrupt persistence failures that need user-visible recovery guidance. */
  persistenceNotice: Exclude<LoadIssue, 'none' | 'corrupt'> | 'save-failed' | null;
  /** Reconcile queued external commands after boot or foregrounding. */
  reconcileQuickEntries: () => Promise<void>;
}

export function useStore(store: Store = defaultStore): UseStore {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [showCorruptNotice, setShowCorruptNotice] = useState(false);
  const [hasCorruptStash, setHasCorruptStash] = useState(false);
  const [persistenceNotice, setPersistenceNotice] = useState<UseStore['persistenceNotice']>(null);

  useEffect(() => {
    let alive = true;
    store.load().then(async (loaded) => {
      const corrupt = store.wasLastLoadCorrupt();
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
        const durableDevice = {
          ...prev.device,
          ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
          ...(patch.budgetMode !== undefined ? { budgetMode: patch.budgetMode } : {}),
          ...(patch.totalBudget !== undefined ? { totalBudget: patch.totalBudget } : {}),
          ...(patch.calendarView !== undefined ? { calendarView: patch.calendarView } : {}),
          ...(patch.motion !== undefined ? { motion: patch.motion } : {}),
          ...(patch.summaryGranularity !== undefined ? { summaryGranularity: patch.summaryGranularity } : {}),
        };
        const durableState = withIdentitySlices({ ...next, device: durableDevice }, false, true);
        void store.save(durableState).then(
          () => {
            setState((current) => ({ ...current, household: durableState.household, device: durableDevice }));
            setPersistenceNotice((current) => (current === 'save-failed' ? null : current));
          },
          () => setPersistenceNotice('save-failed'),
        );
        return next;
      });
    },
    [store],
  );

  const readCorruptStash = useCallback(() => store.readCorruptStash(), [store]);
  const reconcileQuickEntries = useCallback(async () => {
    if (!ready) return;
    const result = await store.reconcileQuickEntryCommands(state);
    if (result.state !== state) setState(result.state);
  }, [ready, state, store]);

  return {
    ready,
    state,
    update,
    showCorruptNotice,
    hasCorruptStash,
    readCorruptStash,
    persistenceNotice,
    reconcileQuickEntries,
  };
}
