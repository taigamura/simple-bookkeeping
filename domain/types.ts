/**
 * Domain types — the money model (build-decisions "Data model & logic").
 *
 * `Transaction` carries `y` (full year) + `m` (0-based month, so July = 6) in
 * addition to `day`, the deliberate persistence divergence from the prototype's
 * hardcoded July-2026: real entries store their own year/month so the ledger
 * spans real months. `accountId`/`repeat` are reserved for later slices.
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
  repeat?: Repeat; // reserved; always 'never' until slice #6
  accountId?: string; // reserved; unused in v1 (decision 1)
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
