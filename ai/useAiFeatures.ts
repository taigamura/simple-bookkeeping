/**
 * Orchestrates the two background AI writes (ADR-0006), using only the domain
 * functions exported from `ai/index.ts`:
 *
 * - **Letter.** While Summary is showing, if last month had entries and has no
 *   saved letter: `buildFacts(last month)` → `writeLetter` → keep only the
 *   paragraphs `renderCited` accepts → save under `ai.letters['YYYY-MM']` with
 *   the cited facts' displays frozen. Written once; never rewritten.
 * - **Nudge.** At most once per local day: `buildFacts(this month)` →
 *   `pickNudge` → save `ai.nudge` (tokens + frozen displays, or text null when
 *   the model said nothing or its text failed `renderCited`).
 *
 * Both are skipped unless the on-device model is available and the
 * 「ふりかえりと気づき」 switch (`nudgesEnabled`) is on.
 *
 * `updateAi` is the one writer for `state.ai` (Settings switches, dismissals
 * and these background writes all go through it). The store's `update` takes a
 * shallow patch, so two writes landing in the same tick would otherwise each
 * spread a stale `state.ai` and the second would erase the first; a ref that
 * every write advances synchronously closes that gap.
 */
import { useCallback, useEffect, useRef } from 'react';

import { entriesForMonth, shiftMonth } from '../domain';
import type { AppState } from '../store/schema';
import { useAi } from './AiProvider';
import type { AiState } from './state';
import { buildFacts, citedIds, factDisplays, renderCited, type Fact, type Locale, type YMD } from './index';

export interface AiFeaturesInput {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  today: YMD;
  locale: Locale;
  /** True while the Summary tab is on screen (the letter is written on first open). */
  active: boolean;
}

export interface AiFeatures {
  updateAi: (change: (ai: AiState) => AiState) => void;
}

export const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
export const dayKey = ({ y, m, day }: YMD) => `${monthKey(y, m)}-${String(day).padStart(2, '0')}`;

function frozenDisplays(facts: Fact[], texts: string[]): Record<string, string> {
  const ids = new Set(texts.flatMap((t) => citedIds(t)));
  return factDisplays(facts.filter((f) => ids.has(f.id)));
}

export function useAiFeatures({ state, update, today, locale, active }: AiFeaturesInput): AiFeatures {
  const { ai, availability } = useAi();
  const available = availability.onDevice === 'available';

  // Latest state for the async work, and the write-ahead copy of `state.ai`.
  const stateRef = useRef(state);
  stateRef.current = state;
  const aiRef = useRef(state.ai);
  const seenAi = useRef(state.ai);
  if (seenAi.current !== state.ai) {
    // An outside write (restore, sample data) replaced `ai`: adopt it.
    seenAi.current = state.ai;
    aiRef.current = state.ai;
  }

  const updateAi = useCallback(
    (change: (current: AiState) => AiState) => {
      const next = change(aiRef.current);
      aiRef.current = next;
      seenAi.current = next;
      update({ ai: next });
    },
    [update],
  );

  const running = useRef(false);
  const lettersTried = useRef(new Set<string>());
  const nudgeTried = useRef<string | null>(null);
  const enabled = available && state.ai.nudgesEnabled;
  const todayKey = dayKey(today);

  useEffect(() => {
    if (!enabled || !active || running.current) return;
    running.current = true;

    const run = async () => {
      // ---- letter for last month
      const prev = shiftMonth({ y: today.y, m: today.m }, -1);
      const key = monthKey(prev.y, prev.m);
      const s = stateRef.current;
      const hadEntries =
        entriesForMonth({ entries: s.entries, recurrenceRules: s.recurrenceRules }, prev).length > 0;
      if (!aiRef.current.letters[key] && !lettersTried.current.has(key) && hadEntries) {
        lettersTried.current.add(key);
        const facts = buildFacts(s, prev.y, prev.m, today, locale);
        const draft = await ai.writeLetter({ y: prev.y, m: prev.m, facts, locale });
        if (draft) {
          const all = factDisplays(facts);
          const paragraphs = draft.paragraphs.filter((p) => renderCited(p, all) !== null);
          if (paragraphs.length > 0) {
            const letter = {
              paragraphs,
              facts: frozenDisplays(facts, paragraphs),
              createdAt: new Date().toISOString(),
              dismissed: false,
            };
            updateAi((cur) => ({ ...cur, letters: { ...cur.letters, [key]: letter } }));
          }
        }
      }

      // ---- today's nudge
      if (aiRef.current.nudge?.date !== todayKey && nudgeTried.current !== todayKey) {
        nudgeTried.current = todayKey;
        const facts = buildFacts(stateRef.current, today.y, today.m, today, locale);
        const draft = await ai.pickNudge({ facts, locale });
        const ok = draft !== null && renderCited(draft.text, factDisplays(facts)) !== null;
        const nudge = {
          date: todayKey,
          text: ok ? draft!.text : null,
          facts: ok ? frozenDisplays(facts, [draft!.text]) : {},
          dismissed: false,
        };
        updateAi((cur) => ({ ...cur, nudge }));
      }
    };

    run()
      .catch(() => {
        // A model failure is silent: the surfaces simply don't appear.
      })
      .finally(() => {
        running.current = false;
      });
    // Deliberately no abort on cleanup: a finished write is still worth
    // saving, and the tried-guards above keep it to one attempt per key.
    // `today` is tracked through its day key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, active, todayKey, locale, ai, updateAi]);

  return { updateAi };
}
