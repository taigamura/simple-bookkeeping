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
import { createStore, type Store } from './store';

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
}

export function useStore(store: Store = defaultStore): UseStore {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [showCorruptNotice, setShowCorruptNotice] = useState(false);
  const [hasCorruptStash, setHasCorruptStash] = useState(false);

  useEffect(() => {
    let alive = true;
    store.load().then(async (loaded) => {
      const corrupt = store.wasLastLoadCorrupt();
      const stashed = await store.hasCorruptStash();
      if (!alive) return;
      setState(loaded);
      setShowCorruptNotice(corrupt);
      setHasCorruptStash(stashed);
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
        void store.save(next);
        return next;
      });
    },
    [store],
  );

  const readCorruptStash = useCallback(() => store.readCorruptStash(), [store]);

  return { ready, state, update, showCorruptNotice, hasCorruptStash, readCorruptStash };
}
