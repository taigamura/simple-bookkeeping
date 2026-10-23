/**
 * Suito AI — the one native seam (ADR-0006, PRD "Suito AI").
 *
 * Every model call and every system integration (Siri snapshot, Siri inbox,
 * Spotlight) goes through `SuitoAi`. Three implementations: the iOS Swift
 * module (`modules/suito-ai`), a deterministic fake for web/e2e/jest
 * (`ai/fake.ts`, `?ai=fake`), and `UNAVAILABLE_AI` (everything off).
 *
 * Rule: code computes every number; models only choose and phrase. Model text
 * refers to numbers through fact tokens like `{f:budget-left}`, which
 * `ai/cite.ts` replaces with the fact's display string.
 *
 * The Apple cloud model (Private Cloud Compute) is compiled out of this
 * release: the privacy gate in ADR-0006 could not be verified. `availability`
 * still reports it so the UI can grow into it later.
 */
import type { TxType } from '../domain';

export type Locale = 'ja' | 'en';

export interface Availability {
  /** On-device Foundation Models. Every in-app AI surface renders only when 'available'. */
  onDevice: 'available' | 'unsupported' | 'disabled' | 'notReady';
  /** Siri/Shortcuts/Spotlight integration (any iOS 26 phone, no model needed). */
  system: 'available' | 'unsupported';
}

/** A calendar date in the ledger's own convention (m is 0-based). */
export interface YMD {
  y: number;
  m: number;
  day: number;
}

// ---------------------------------------------------------------- entry parse

export interface ParseContext {
  expCats: string[];
  incCats: string[];
  today: YMD;
  locale: Locale;
}

/** Model output after native post-processing. Every field optional: only what
 *  the phrase actually said. `category` is always one of the passed cats. */
export interface ParsedEntry {
  type?: TxType;
  amount?: number;
  category?: string;
  date?: YMD;
  note?: string;
}

// ---------------------------------------------------------------- facts

/** One code-computed fact the models may cite. `id` is stable per kind
 *  (e.g. 'expense-total', 'cat-pace:食費', 'no-spend-days'). */
export interface Fact {
  id: string;
  /** Short English description for the model, e.g. "Food spending vs last month: +32%". */
  label: string;
  /** The exact string shown to the user in place of `{f:<id>}`, already
   *  formatted for locale + currency, e.g. "¥12,400" or "+32%". */
  display: string;
  /** Raw number, for ranking/tests. */
  value: number;
  /** Sentiment hint for the kindness filter. */
  tone: 'positive' | 'neutral' | 'watch';
}

export interface LetterRequest {
  /** Year-month the letter is about. */
  y: number;
  m: number;
  facts: Fact[];
  locale: Locale;
}

/** Paragraphs contain `{f:<id>}` tokens and no literal digits. */
export interface LetterDraft {
  paragraphs: string[];
}

export interface NudgeRequest {
  facts: Fact[];
  locale: Locale;
}

/** `null` = the model chose to say nothing. `text` holds `{f:<id>}` tokens. */
export type NudgeDraft = { text: string } | null;

// ---------------------------------------------------------------- ask

export interface AskTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AskRequest {
  requestId: string;
  question: string;
  history: AskTurn[];
  locale: Locale;
}

export interface AskResult {
  text: string;
  /** The model judged the question beyond it (advice, open-ended planning). */
  needsStrongerModel: boolean;
}

// ---------------------------------------------------------------- siri bridge

/** Written by JS after every save; read by Swift (App Intents, Ask tools,
 *  Spotlight). Lives in the app's Documents dir as `suito-siri-snapshot.json`. */
export interface SiriSnapshot {
  version: 1;
  generatedAt: string; // ISO instant
  locale: Locale;
  currency: { symbol: string; code: string };
  today: string; // YYYY-MM-DD
  expCats: string[];
  incCats: string[];
  /** Concrete entries + repeat occurrences projected ±12 months from today,
   *  plus any not-yet-merged inbox entries (`inbox: true`). Sorted by date. */
  entries: SnapshotEntry[];
  /** Precomputed per month, key 'YYYY-MM' (1-based month in the key). */
  months: Record<string, MonthTotals>;
}

export interface SnapshotEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category: string;
  note: string;
  repeat: boolean;
  inbox?: true;
}

export interface MonthTotals {
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, number>; // expense per category
  budget: number | null; // null = no budget set
  budgetLeft: number | null;
  noSpendDays: number; // days elapsed in the month with no expense
}

/** Appended by the Siri "Add entry" intent; merged by the store on launch/foreground. */
export interface InboxEntry {
  id: string; // uuid from Swift; dedup key
  createdAt: string; // ISO instant
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category: string;
  note: string;
}

export interface SpotlightRequest {
  enabled: boolean;
  /** Concrete (non-projected) entries to index when enabled; ignored when disabled
   *  (disabling clears the whole index). */
  entries: SnapshotEntry[];
}

// ---------------------------------------------------------------- the seam

export interface SuitoAi {
  availability(): Promise<Availability>;
  parseEntry(text: string, ctx: ParseContext): Promise<ParsedEntry | null>;
  writeLetter(req: LetterRequest): Promise<LetterDraft | null>;
  pickNudge(req: NudgeRequest): Promise<NudgeDraft>;
  /** Streams cumulative text (each call gets the full text so far). */
  ask(req: AskRequest, onText: (textSoFar: string) => void): Promise<AskResult>;
  cancelAsk(requestId: string): void;

  writeSiriSnapshot(snapshot: SiriSnapshot): Promise<void>;
  readSiriInbox(): Promise<InboxEntry[]>;
  clearSiriInbox(ids: string[]): Promise<void>;
  setSpotlight(req: SpotlightRequest): Promise<void>;
}

const off: Availability = { onDevice: 'unsupported', system: 'unsupported' };

/** Everything off: web without `?ai=fake`, Android, missing native module. */
export const UNAVAILABLE_AI: SuitoAi = {
  availability: async () => off,
  parseEntry: async () => null,
  writeLetter: async () => null,
  pickNudge: async () => null,
  ask: async () => ({ text: '', needsStrongerModel: false }),
  cancelAsk: () => {},
  writeSiriSnapshot: async () => {},
  readSiriInbox: async () => [],
  clearSiriInbox: async () => {},
  setSpotlight: async () => {},
};
