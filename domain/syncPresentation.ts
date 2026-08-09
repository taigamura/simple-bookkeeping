import type { SyncHistoryEntry, SyncState, Transaction, TransactionAttribution } from './sync';

/** The four states exposed by the household surface. None of these imply a
 * server, background work, or an always-on connection. */
export type HouseholdSyncStatus = 'paired' | 'offline' | 'syncing' | 'error';

export interface SyncStatusFacts {
  paired: boolean;
  /** The native nearby transport is foreground-only. */
  foreground: boolean;
  partnerPresent: boolean;
  queuedOperationCount: number;
  lastSyncedAt?: string;
  error?: string;
}

export interface SyncStatusModel {
  status: HouseholdSyncStatus;
  lastSyncedAt?: string;
  queuedOperationCount: number;
  /** A missing partner never makes this action unsafe: the caller can keep
   * it enabled and receive `partner-absent` instead of throwing. */
  syncNow: 'available' | 'partner-absent' | 'not-paired';
  error?: string;
}

export type SyncHistoryChange = 'added' | 'edited' | 'deleted';

export interface SyncHistoryRow {
  transactionId: string;
  operationId: string;
  change: SyncHistoryChange;
  actorId: string;
  /** Deliberately excludes note and other free-form fields. */
  transaction?: Pick<Transaction, 'id' | 'y' | 'm' | 'day' | 'type' | 'amount' | 'category'>;
  attribution?: TransactionAttribution;
}

export interface SyncFailureMessage {
  title: string;
  message: string;
}

const SAFE_ERROR_MESSAGES: Record<string, SyncFailureMessage> = {
  'invalid-operation': {
    title: 'Sync could not apply a change',
    message: 'The change was rejected and your local entries were kept.',
  },
  'wrong-household': {
    title: 'Sync stopped',
    message: 'That change belongs to another paired household. Nothing was changed.',
  },
  'partner-absent': {
    title: 'Partner not nearby',
    message: 'Nothing was changed. Keep both phones open and nearby, then try Sync now again.',
  },
  rollback: {
    title: 'Restore could not be completed',
    message: 'Nothing was changed. The current entry and its history were kept.',
  },
};

const JA_ERROR_MESSAGES: Record<string, SyncFailureMessage> = {
  'invalid-operation': {
    title: '同期できませんでした',
    message: '変更は拒否されました。端末の記録は保持されています。',
  },
  'wrong-household': {
    title: '同期を停止しました',
    message: '別のペアの変更です。記録は変更されていません。',
  },
  'partner-absent': {
    title: '相手の端末が近くにありません',
    message: '変更はありません。2台のアプリを開いて近くに置き、もう一度同期してください。',
  },
  rollback: {
    title: '復元できませんでした',
    message: '現在の記録と履歴は保持されています。',
  },
};

export function householdSyncStatus(facts: SyncStatusFacts): SyncStatusModel {
  const queuedOperationCount = Number.isSafeInteger(facts.queuedOperationCount) && facts.queuedOperationCount > 0
    ? facts.queuedOperationCount : 0;
  const status: HouseholdSyncStatus = facts.error
    ? 'error'
    : !facts.paired || !facts.foreground || !facts.partnerPresent
      ? 'offline'
      : queuedOperationCount > 0 ? 'syncing' : 'paired';
  return {
    status,
    lastSyncedAt: facts.lastSyncedAt,
    queuedOperationCount,
    syncNow: !facts.paired ? 'not-paired' : facts.partnerPresent && facts.foreground ? 'available' : 'partner-absent',
    ...(facts.error ? { error: facts.error } : {}),
  };
}

function safeTransaction(transaction: Transaction): SyncHistoryRow['transaction'] {
  return {
    id: transaction.id, y: transaction.y, m: transaction.m, day: transaction.day,
    type: transaction.type, amount: transaction.amount, category: transaction.category,
  };
}

/** Flatten audit history into rows suitable for a user-facing history list.
 * Notes are intentionally omitted so the history cannot leak free-form text. */
export function syncHistoryRows(state: SyncState): SyncHistoryRow[] {
  return Object.entries(state.history)
    .flatMap(([transactionId, entries]) => entries.map((entry: SyncHistoryEntry): SyncHistoryRow => ({
      transactionId,
      operationId: entry.operationId,
      change: entry.kind === 'add-transaction' ? 'added' : entry.kind === 'edit-transaction' ? 'edited' : 'deleted',
      actorId: entry.actorId,
      ...(entry.transaction ? { transaction: safeTransaction(entry.transaction) } : {}),
      ...(state.attribution[transactionId] ? { attribution: state.attribution[transactionId] } : {}),
    })))
    .sort((a, b) => a.operationId.localeCompare(b.operationId));
}

export function syncFailureMessage(code: string, language: 'en' | 'ja' = 'en'): SyncFailureMessage {
  const messages = language === 'ja' ? JA_ERROR_MESSAGES : SAFE_ERROR_MESSAGES;
  return messages[code] ?? (language === 'ja'
    ? { title: '同期に失敗しました', message: '変更はありません。もう一度お試しください。' }
    : { title: 'Sync failed', message: 'Nothing was changed. Try again.' });
}
