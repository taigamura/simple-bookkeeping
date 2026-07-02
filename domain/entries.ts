/**
 * Entry aggregation + construction (build-decisions "Aggregation" / "save()").
 * All pure over a `Transaction[]`; no store or React here. The prototype's
 * hardcoded-July gate becomes a real `y`/`m` filter so the ledger spans months.
 */
import { amountValue } from './keypad';
import type { Transaction, TxType, YM } from './types';

/** Entries belonging to a given year+month. */
export function monthEntries(all: Transaction[], ym: YM): Transaction[] {
  return all.filter((t) => t.y === ym.y && t.m === ym.m);
}

/** Entries on a specific day within an already month-filtered list. */
export function dayEntries(entries: Transaction[], day: number): Transaction[] {
  return entries.filter((t) => t.day === day);
}

/** Signed value of one entry: income adds, expense subtracts. */
export function signedAmount(t: Transaction): number {
  return t.type === 'income' ? t.amount : -t.amount;
}

/** Signed net for one day, over an already month-filtered list. */
export function dayNet(entries: Transaction[], day: number): number {
  return dayEntries(entries, day).reduce((sum, t) => sum + signedAmount(t), 0);
}

/** Draft captured by the Entry sheet before it becomes a `Transaction`. */
export interface EntryDraft {
  type: TxType;
  amountStr: string;
  category: string;
  note?: string;
  y: number;
  m: number;
  day: number;
}

/** Best-effort unique id (no crypto dependency): time + random suffix. */
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Build a `Transaction` from a draft, applying the save() rules: parse the
 * integer amount and return `null` when it is 0 (no-op), and fall back to the
 * category when the note is empty or the "—" placeholder.
 */
export function makeEntry(draft: EntryDraft): Transaction | null {
  const amount = amountValue(draft.amountStr);
  if (amount <= 0) return null;

  const trimmed = draft.note?.trim();
  const note = !trimmed || trimmed === '—' ? draft.category : trimmed;

  return {
    id: uid(),
    y: draft.y,
    m: draft.m,
    day: draft.day,
    type: draft.type,
    amount,
    category: draft.category,
    note,
    repeat: 'never',
  };
}
