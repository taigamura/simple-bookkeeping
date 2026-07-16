/**
 * Domain types — the money model (build-decisions "Data model & logic").
 *
 * `Transaction` carries `y` (full year) + `m` (0-based month, so July = 6) in
 * addition to `day`, the deliberate persistence divergence from the prototype's
 * hardcoded July-2026: real entries store their own year/month so the ledger
 * spans real months. Persisted recurrence rules project transactions carrying
 * an occurrence reference; `accountId` remains reserved.
 */
export type TxType = 'income' | 'expense';

export type Repeat = 'never' | 'daily' | 'monthly' | 'yearly';

/** Weekend shift for recurrence (slice #6): Monday / Friday / keep. */
export type WeekendShift = 'after' | 'before' | 'off';

export interface Transaction {
  id: string;
  y: number; // full year, e.g. 2026
  m: number; // 0-based month (Jan = 0 … Dec = 11)
  day: number; // day-of-month within (y, m)
  type: TxType;
  amount: number; // integer, no minor units
  category: string;
  note: string;
  repeat?: Repeat;
  accountId?: string; // reserved; unused in v1 (decision 1)
  /** Present only on a projected occurrence; recurring rules, not occurrences,
   * are persisted. The scheduled date stays stable when weekend handling moves
   * the displayed transaction into another month. */
  occurrence?: RecurrenceOccurrence;
}

export interface RecurrenceDate {
  y: number;
  m: number;
  day: number;
}

export interface RecurrenceOccurrence {
  ruleId: string;
  scheduled: RecurrenceDate;
  weekendShift: WeekendShift;
}

/** Persisted description of an unbounded repeating transaction. */
export interface RecurrenceRule {
  id: string;
  start: RecurrenceDate;
  /** Original requested day, retained across short months. */
  anchorDay: number;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  repeat: Exclude<Repeat, 'never'>;
  weekendShift: WeekendShift;
  /** Scheduled occurrence keys omitted without changing the cadence. */
  exceptions: string[];
  /** Exclusive scheduled-date cutoff used by edit/delete-this-and-future. */
  endsBefore?: string;
}

export interface Ledger {
  entries: Transaction[];
  recurrenceRules: RecurrenceRule[];
}

/** Symbol-only currency (decision 11): swap symbol + reformat, no FX. */
export interface Currency {
  symbol: string;
  code: string;
}

/** A year + 0-based month pair — the calendar cursor / filter key. */
export interface YM {
  y: number;
  m: number;
}
