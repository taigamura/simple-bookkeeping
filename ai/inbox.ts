/**
 * Merge Siri-added inbox entries into the ledger (ADR-0006). Pure: the
 * `useSiriBridge` hook does the I/O (read → merge → update → clear).
 */
import { daysInMonth, type Transaction } from '../domain';
import type { InboxEntry } from './contract';

export interface InboxMerge {
  entries: Transaction[];
  /** Inbox ids now in the ledger (new or already merged) — safe to clear. */
  mergedIds: string[];
}

/** Ledger id for an inbox item; also the dedup key. */
export const inboxEntryId = (inboxId: string): string => `siri-${inboxId}`;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The item as a ledger transaction, or `null` when it fails validation
 *  (bad date, bad type, non-positive or non-integer amount, empty id). */
export function inboxToTransaction(item: InboxEntry): Transaction | null {
  if (typeof item.id !== 'string' || item.id.length === 0) return null;
  if (item.type !== 'income' && item.type !== 'expense') return null;
  if (typeof item.amount !== 'number' || !Number.isInteger(item.amount) || item.amount <= 0) return null;
  const match = typeof item.date === 'string' ? DATE.exec(item.date) : null;
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (m < 0 || m > 11 || day < 1 || day > daysInMonth(y, m)) return null;
  // The persisted schema demands `toISOString()` form (with milliseconds);
  // Swift's ISO8601DateFormatter omits them, so normalise here.
  const created = new Date(item.createdAt);
  const timestamp = Number.isNaN(created.getTime())
    ? new Date(Date.UTC(y, m, day, 12)).toISOString()
    : created.toISOString();
  return {
    id: inboxEntryId(item.id),
    timestamp,
    y,
    m,
    day,
    type: item.type,
    amount: item.amount,
    category: typeof item.category === 'string' ? item.category : '',
    note: typeof item.note === 'string' ? item.note : '',
    repeat: 'never',
  };
}

export function mergeInbox(entries: Transaction[], inbox: InboxEntry[]): InboxMerge {
  const ids = new Set(entries.map((e) => e.id));
  const added: Transaction[] = [];
  const mergedIds: string[] = [];
  for (const item of inbox) {
    const tx = inboxToTransaction(item);
    if (!tx) continue;
    if (!mergedIds.includes(item.id)) mergedIds.push(item.id);
    if (ids.has(tx.id)) continue;
    ids.add(tx.id);
    added.push(tx);
  }
  return { entries: added.length > 0 ? [...entries, ...added] : entries, mergedIds };
}
