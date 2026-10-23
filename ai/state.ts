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

export interface AiState {
  nudgesEnabled: boolean;
  /** Spotlight indexing (Settings 「Siriと検索」). On by default (ADR-0006). */
  spotlightEnabled: boolean;
  /** Keyed 'YYYY-MM' (1-based month). */
  letters: Record<string, SavedLetter>;
  nudge: SavedNudge | null;
}

export const DEFAULT_AI_STATE: AiState = {
  nudgesEnabled: true,
  spotlightEnabled: true,
  letters: {},
  nudge: null,
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
  };
}
