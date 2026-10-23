/**
 * Calendar one-liners (PRD #145): month-end forecast, day note, repeat
 * suggestion. Code computes the facts (`ai/forecast.ts`, `ai/dayFacts.ts`,
 * `ai/repeatSuggestion.ts`); the model only words them through `wordLine`.
 *
 * Gated like the Summary surfaces: on-device model available AND the
 * 「ふりかえりと気づき」 switch (`ai.nudgesEnabled`) on. Otherwise nothing is
 * computed, asked or shown.
 *
 * Caching (in `state.ai.calendar`, written through the host's `updateAi`):
 * - forecast: once per local day (key = today's date)
 * - day note: once per date + entries hash (editing the day re-asks)
 * - repeat: once per suggestion key per day
 * A line is shown only when its cached key matches; numbers render from the
 * live facts (frozen displays are the fallback), so the forecast stays right
 * after a save even though the wording is from this morning.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { entriesForMonth, type Transaction } from '../domain';
import type { AppState } from '../store/schema';
import { useAi } from './AiProvider';
import { citedIds, factDisplays, renderCited } from './cite';
import type { Fact, LineKind, Locale, YMD } from './contract';
import { buildDayFacts, dayEntriesHash } from './dayFacts';
import { buildForecastFacts } from './forecast';
import { suggestRepeat } from './repeatSuggestion';
import { pruneDayNotes, type AiState, type SavedLine } from './state';
import { dayKey } from './useAiFeatures';

export interface CalendarAiInput {
  state: AppState;
  today: YMD;
  locale: Locale;
  updateAi: (change: (ai: AiState) => AiState) => void;
}

export interface CalendarAiLines {
  /** AI surfaces render at all (reserve their slots only when true). */
  enabled: boolean;
  /** The displayed month is the current month (forecast + repeat live there). */
  isCurrentMonth: boolean;
  forecast: string | null;
  /** The selected day has notable facts: a note is on its way or shown. */
  dayNoteExpected: boolean;
  dayNote: string | null;
  repeat: { key: string; entry: Transaction; text: string | null } | null;
  dismissRepeat: (key: string) => void;
}

function frozen(facts: Fact[], text: string): Record<string, string> {
  const ids = new Set(citedIds(text));
  return factDisplays(facts.filter((f) => ids.has(f.id)));
}

function show(line: SavedLine | null | undefined, key: string, facts: Fact[] | null, locale: Locale) {
  if (!line || line.key !== key || line.text === null) return null;
  const out = renderCited(line.text, { ...line.facts, ...factDisplays(facts ?? []) }, locale);
  return out && out.trim() !== '' ? out : null;
}

export function useCalendarAi(
  input: CalendarAiInput | null,
  view: { y: number; m: number; day: number },
): CalendarAiLines {
  const { ai, availability } = useAi();
  const enabled = !!input && availability.onDevice === 'available' && input.state.ai.nudgesEnabled;
  const state = input?.state;
  const today = input?.today;
  const locale: Locale = input?.locale ?? 'en';
  const isCurrentMonth = !!today && view.y === today.y && view.m === today.m;
  const todayKey = today ? dayKey(today) : '';
  const cal = state?.ai.calendar;

  // ---- facts (pure; only while enabled)
  const forecastFacts = useMemo(
    () => (enabled && state && today ? buildForecastFacts(state, today, locale) : null),
    // todayKey stands in for `today`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, state?.entries, state?.recurrenceRules, state?.currency, state?.budgets, state?.budgetMode, state?.totalBudget, todayKey, locale],
  );
  const selected: YMD = { y: view.y, m: view.m, day: view.day };
  const selectedKey = dayKey(selected);
  const dayHash = useMemo(() => {
    if (!enabled || !state) return '';
    return dayEntriesHash(entriesForMonth(state, view).filter((t) => t.day === view.day));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, state?.entries, state?.recurrenceRules, selectedKey]);
  const dayFacts = useMemo(
    () => (enabled && state && today ? buildDayFacts(state, selected, today, locale) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, state?.entries, state?.recurrenceRules, state?.currency, selectedKey, todayKey, locale],
  );
  const dismissed = cal?.dismissedRepeats;
  const suggestion = useMemo(
    () => (enabled && state && today ? suggestRepeat(state, today, dismissed ?? [], locale) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, state?.entries, state?.recurrenceRules, state?.currency, dismissed, todayKey, locale],
  );

  const forecastKey = todayKey;
  const dayLineKey = `${selectedKey}#${dayHash}`;
  const repeatLineKey = suggestion ? `${suggestion.key}@${todayKey}` : '';

  // ---- ask the model, at most once per key
  const tried = useRef(new Set<string>());
  const updateAi = input?.updateAi;
  const ask = useCallback(
    (kind: LineKind, key: string, facts: Fact[], save: (line: SavedLine) => (cur: AiState) => AiState) => {
      const tag = `${kind}:${key}`;
      if (tried.current.has(tag) || !updateAi) return;
      tried.current.add(tag);
      ai.wordLine({ kind, facts, locale })
        .catch(() => null)
        .then((draft) => {
          const ok = draft !== null && renderCited(draft.text, factDisplays(facts), locale) !== null;
          const text = ok ? draft!.text : null;
          updateAi(save({ key, text, facts: text ? frozen(facts, text) : {} }));
        });
    },
    [ai, locale, updateAi],
  );

  useEffect(() => {
    if (!enabled || !forecastFacts || cal?.forecast?.key === forecastKey) return;
    ask('forecast', forecastKey, forecastFacts, (line) => (cur) => ({
      ...cur,
      calendar: { ...cur.calendar, forecast: line },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, forecastFacts, forecastKey, ask]);

  useEffect(() => {
    if (!enabled || dayFacts.length === 0 || cal?.dayNotes[selectedKey]?.key === dayLineKey) return;
    ask('day', dayLineKey, dayFacts, (line) => (cur) => ({
      ...cur,
      calendar: {
        ...cur.calendar,
        dayNotes: pruneDayNotes({ ...cur.calendar.dayNotes, [selectedKey]: line }),
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dayFacts, dayLineKey, ask]);

  useEffect(() => {
    if (!enabled || !suggestion || cal?.repeat?.key === repeatLineKey) return;
    ask('repeat', repeatLineKey, suggestion.facts, (line) => (cur) => ({
      ...cur,
      calendar: { ...cur.calendar, repeat: line },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, suggestion, repeatLineKey, ask]);

  const dismissRepeat = useCallback(
    (key: string) =>
      updateAi?.((cur) =>
        cur.calendar.dismissedRepeats.includes(key)
          ? cur
          : {
              ...cur,
              calendar: { ...cur.calendar, dismissedRepeats: [...cur.calendar.dismissedRepeats, key] },
            },
      ),
    [updateAi],
  );

  if (!enabled) {
    return {
      enabled: false,
      isCurrentMonth,
      forecast: null,
      dayNoteExpected: false,
      dayNote: null,
      repeat: null,
      dismissRepeat,
    };
  }

  const repeatText = suggestion ? show(cal?.repeat, repeatLineKey, suggestion.facts, locale) : null;
  const repeatDeclined = !!suggestion && cal?.repeat?.key === repeatLineKey && repeatText === null;
  return {
    enabled: true,
    isCurrentMonth,
    forecast: isCurrentMonth ? show(cal?.forecast, forecastKey, forecastFacts, locale) : null,
    dayNoteExpected: dayFacts.length > 0 && !(cal?.dayNotes[selectedKey]?.key === dayLineKey && cal.dayNotes[selectedKey].text === null),
    dayNote: dayFacts.length > 0 ? show(cal?.dayNotes[selectedKey], dayLineKey, dayFacts, locale) : null,
    repeat:
      suggestion && isCurrentMonth && !repeatDeclined
        ? { key: suggestion.key, entry: suggestion.entry, text: repeatText }
        : null,
    dismissRepeat,
  };
}
