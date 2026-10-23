/**
 * Persisted AI state (`AppState.ai`). Added after v1 blobs shipped; the
 * merge-by-known-keys load fills it from `DEFAULT_AI_STATE`, so no schema bump.
 */

/** A saved monthly letter. Paragraphs keep `{f:<id>}` tokens; `facts` freezes
 *  each cited fact's display string so the letter never changes after writing. */
export interface SavedLetter {
  paragraphs: string[];
  facts: Record<string, string>;
  createdAt: string; // ISO instant
  dismissed: boolean;
}

export interface SavedNudge {
  date: string; // YYYY-MM-DD the nudge was picked; refresh at most once a day
  text: string | null; // `{f:<id>}` tokens; null = model chose nothing today
  facts: Record<string, string>;
  dismissed: boolean;
}

/** One cached Calendar one-liner (PRD #145). `key` says what it was worded
 *  for (forecast: today's date; day note: date#entries-hash; repeat:
 *  suggestion-key@today), so it is asked at most once per key. `facts` freezes
 *  the cited displays as a fallback; the screen prefers live fact displays so
 *  the numbers stay current through the day. */
export interface SavedLine {
  key: string;
  text: string | null; // `{f:<id>}` tokens; null = the model said nothing
  facts: Record<string, string>;
}

export interface CalendarAiState {
  forecast: SavedLine | null;
  /** Keyed by 'YYYY-MM-DD'; pruned to the most recent DAY_NOTE_LIMIT. */
  dayNotes: Record<string, SavedLine>;
  repeat: SavedLine | null;
  /** Repeat-suggestion keys the user dismissed; they never return. */
  dismissedRepeats: string[];
}

export const DAY_NOTE_LIMIT = 62;

export const DEFAULT_CALENDAR_AI: CalendarAiState = {
  forecast: null,
  dayNotes: {},
  repeat: null,
  dismissedRepeats: [],
};

export interface AiState {
  nudgesEnabled: boolean;
  /** Spotlight indexing (Settings 「Siriと検索」). On by default (ADR-0006). */
  spotlightEnabled: boolean;
  /** Keyed 'YYYY-MM' (1-based month). */
  letters: Record<string, SavedLetter>;
  nudge: SavedNudge | null;
  /** Calendar one-liners (forecast, day note, repeat suggestion). */
  calendar: CalendarAiState;
}

export const DEFAULT_AI_STATE: AiState = {
  nudgesEnabled: true,
  spotlightEnabled: true,
  letters: {},
  nudge: null,
  calendar: DEFAULT_CALENDAR_AI,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringMap(v: unknown): v is Record<string, string> {
  return isRecord(v) && Object.values(v).every((x) => typeof x === 'string');
}

function isLetter(v: unknown): v is SavedLetter {
  return (
    isRecord(v) &&
    Array.isArray(v.paragraphs) &&
    v.paragraphs.every((p) => typeof p === 'string') &&
    isStringMap(v.facts) &&
    typeof v.createdAt === 'string' &&
    typeof v.dismissed === 'boolean'
  );
}

function isNudge(v: unknown): v is SavedNudge {
  return (
    isRecord(v) &&
    typeof v.date === 'string' &&
    (v.text === null || typeof v.text === 'string') &&
    isStringMap(v.facts) &&
    typeof v.dismissed === 'boolean'
  );
}

function isLine(v: unknown): v is SavedLine {
  return (
    isRecord(v) &&
    typeof v.key === 'string' &&
    (v.text === null || typeof v.text === 'string') &&
    isStringMap(v.facts)
  );
}

/** Keep the most recent `DAY_NOTE_LIMIT` day notes (keys sort by date). */
export function pruneDayNotes(notes: Record<string, SavedLine>): Record<string, SavedLine> {
  const keys = Object.keys(notes).sort();
  if (keys.length <= DAY_NOTE_LIMIT) return notes;
  return Object.fromEntries(keys.slice(-DAY_NOTE_LIMIT).map((k) => [k, notes[k]]));
}

function normalizeCalendar(raw: unknown): CalendarAiState {
  if (!isRecord(raw)) return DEFAULT_CALENDAR_AI;
  const dayNotes: Record<string, SavedLine> = {};
  if (isRecord(raw.dayNotes)) {
    for (const [k, v] of Object.entries(raw.dayNotes)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isLine(v)) dayNotes[k] = v;
    }
  }
  return {
    forecast: isLine(raw.forecast) ? raw.forecast : null,
    dayNotes: pruneDayNotes(dayNotes),
    repeat: isLine(raw.repeat) ? raw.repeat : null,
    dismissedRepeats: Array.isArray(raw.dismissedRepeats)
      ? raw.dismissedRepeats.filter((k): k is string => typeof k === 'string')
      : [],
  };
}

/** Field-by-field: keep what validates, default the rest. Never throws. */
export function normalizeAiState(raw: unknown): AiState {
  if (!isRecord(raw)) return DEFAULT_AI_STATE;
  const letters: Record<string, SavedLetter> = {};
  if (isRecord(raw.letters)) {
    for (const [k, v] of Object.entries(raw.letters)) {
      if (/^\d{4}-\d{2}$/.test(k) && isLetter(v)) letters[k] = v;
    }
  }
  return {
    nudgesEnabled:
      typeof raw.nudgesEnabled === 'boolean' ? raw.nudgesEnabled : DEFAULT_AI_STATE.nudgesEnabled,
    spotlightEnabled:
      typeof raw.spotlightEnabled === 'boolean'
        ? raw.spotlightEnabled
        : DEFAULT_AI_STATE.spotlightEnabled,
    letters,
    nudge: isNudge(raw.nudge) ? raw.nudge : null,
    calendar: normalizeCalendar(raw.calendar),
  };
}
