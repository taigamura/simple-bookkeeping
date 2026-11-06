/**
 * Siri / Spotlight bridge (ADR-0006), called once from `App.tsx`:
 *
 * - On `ready` and on every return to the foreground: read the Siri inbox,
 *   merge it into the ledger, then clear what merged.
 * - After any state change (debounced 500 ms): write the Siri snapshot.
 * - When the concrete entries or the 「Siriと検索」 switch change: update
 *   Spotlight.
 *
 * Everything is skipped unless `availability().system === 'available'`, and
 * every failure is swallowed: this is best-effort and must never break the app.
 */
import { useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';

import type { Transaction } from '../domain';
import type { AppState } from '../store/schema';
import type { Locale, SuitoAi, YMD } from './contract';
import { mergeInbox } from './inbox';
import { buildSiriSnapshot, toSnapshotEntry } from './snapshot';

export interface SiriBridgeInput {
  ai: SuitoAi;
  state: AppState;
  ready: boolean;
  update: (patch: Partial<AppState>) => void;
  locale: Locale;
  today: YMD;
}

export const SNAPSHOT_DEBOUNCE_MS = 500;

/** Siri may leave the category empty: fall back to the first category of the type. */
function withFallbackCategory(t: Transaction, state: AppState): Transaction {
  if (t.category) return t;
  const cats = t.type === 'income' ? state.incCats : state.expCats;
  return { ...t, category: cats[0] ?? '' };
}

export function useSiriBridge({ ai, state, ready, update, locale, today }: SiriBridgeInput): void {
  const latest = useRef({ ai, state, update });
  latest.current = { ai, state, update };

  // One availability check per `ai`; a throwing check counts as unavailable.
  const systemCheck = useRef<{ ai: SuitoAi; ok: Promise<boolean> } | null>(null);
  const systemOk = (): Promise<boolean> => {
    const current = latest.current.ai;
    if (systemCheck.current?.ai !== current) {
      systemCheck.current = {
        ai: current,
        ok: Promise.resolve()
          .then(() => current.availability())
          .then((a) => a.system === 'available', () => false),
      };
    }
    return systemCheck.current.ok;
  };

  // Inbox: merge on ready and on every foreground.
  const syncing = useRef(false);
  useEffect(() => {
    if (!ready) return;
    const sync = async () => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        if (!(await systemOk())) return;
        const inbox = await latest.current.ai.readSiriInbox();
        if (inbox.length === 0) return;
        const before = latest.current.state.entries;
        const { entries, mergedIds } = mergeInbox(before, inbox);
        if (entries !== before) {
          const known = new Set(before.map((e) => e.id));
          latest.current.update({
            entries: entries.map((e) =>
              known.has(e.id) ? e : withFallbackCategory(e, latest.current.state),
            ),
          });
        }
        if (mergedIds.length > 0) await latest.current.ai.clearSiriInbox(mergedIds);
      } catch {
        // best-effort
      } finally {
        syncing.current = false;
      }
    };
    void sync();
    const sub = RNAppState.addEventListener('change', (status) => {
      if (status === 'active') void sync();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ai]);

  // Snapshot: debounced after every state change.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!(await systemOk())) return;
          await ai.writeSiriSnapshot(buildSiriSnapshot(state, today, locale, [], new Date()));
        } catch {
          // best-effort
        }
      })();
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ai, state, locale, today.y, today.m, today.day]);

  // Spotlight: only when the concrete entries or the switch change.
  const enabled = state.ai.spotlightEnabled;
  const entries = state.entries;
  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        if (!(await systemOk())) return;
        await ai.setSpotlight({
          enabled,
          entries: entries.filter((e) => !e.occurrence).map((e) => toSnapshotEntry(e)),
        });
      } catch {
        // best-effort
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ai, enabled, entries]);
}
