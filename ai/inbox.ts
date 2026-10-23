/**
 * Merge Siri-added inbox entries into the ledger. STUB — the domain slice implements it.
 */
import type { Transaction } from '../domain';
import type { InboxEntry } from './contract';

export interface InboxMerge {
  entries: Transaction[];
  /** Inbox ids now in the ledger (new or already merged) — safe to clear. */
  mergedIds: string[];
}

export function mergeInbox(entries: Transaction[], _inbox: InboxEntry[]): InboxMerge {
  return { entries, mergedIds: [] };
}
