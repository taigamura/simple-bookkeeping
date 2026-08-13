import { daysInMonth } from './calendar';
import type { Transaction } from './types';

export const QUICK_ENTRY_COMMAND_VERSION = 1 as const;

export interface QuickEntryDate {
  readonly y: number;
  readonly m: number;
  readonly day: number;
}

/** Immutable payload shared by widgets, intents, controls, and Watch. */
export interface QuickEntryCommand {
  readonly version: typeof QUICK_ENTRY_COMMAND_VERSION;
  readonly source: string;
  readonly id: string;
  readonly timestamp: string;
  readonly amount: number;
  readonly category: string;
  readonly note: string;
  readonly date: QuickEntryDate;
}

export type QuickEntryValidationError =
  | 'invalid-command'
  | 'unsupported-version'
  | 'invalid-source'
  | 'invalid-id'
  | 'invalid-timestamp'
  | 'invalid-amount'
  | 'invalid-category'
  | 'invalid-note'
  | 'invalid-date';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isDate(value: unknown): value is QuickEntryDate {
  if (!isRecord(value)) return false;
  const y = value.y;
  const m = value.m;
  const day = value.day;
  return Number.isSafeInteger(y)
    && Number.isSafeInteger(m) && (m as number) >= 0 && (m as number) <= 11
    && Number.isSafeInteger(day) && (day as number) >= 1
    && (day as number) <= daysInMonth(y as number, m as number);
}

export function validateQuickEntryCommand(value: unknown): QuickEntryValidationError | null {
  if (!isRecord(value)) return 'invalid-command';
  if (value.version !== QUICK_ENTRY_COMMAND_VERSION) return 'unsupported-version';
  if (typeof value.source !== 'string' || !ID_PATTERN.test(value.source)) return 'invalid-source';
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return 'invalid-id';
  if (!isTimestamp(value.timestamp)) return 'invalid-timestamp';
  if (!Number.isSafeInteger(value.amount) || (value.amount as number) <= 0) return 'invalid-amount';
  if (typeof value.category !== 'string' || value.category.trim().length === 0) return 'invalid-category';
  if (typeof value.note !== 'string') return 'invalid-note';
  if (!isDate(value.date)) return 'invalid-date';
  return null;
}

export function quickEntryCommandKey(command: Pick<QuickEntryCommand, 'source' | 'id'>): string {
  return `${command.source}:${command.id}`;
}

export function quickEntryTransactionId(command: Pick<QuickEntryCommand, 'source' | 'id'>): string {
  return `quick:${quickEntryCommandKey(command)}`;
}

export function transactionFromQuickEntryCommand(command: QuickEntryCommand): Transaction {
  return {
    id: quickEntryTransactionId(command),
    timestamp: command.timestamp,
    y: command.date.y,
    m: command.date.m,
    day: command.date.day,
    type: 'expense',
    amount: command.amount,
    category: command.category.trim(),
    note: command.note.trim(),
    repeat: 'never',
  };
}

export interface QuickEntryReconciliation {
  entries: Transaction[];
  applied: QuickEntryCommand[];
  quarantined: unknown[];
}

/** Apply a batch by command identity. Invalid payloads never reach the ledger. */
export function reconcileQuickEntryCommands(
  entries: readonly Transaction[],
  commands: readonly unknown[],
): QuickEntryReconciliation {
  const next = [...entries];
  const applied: QuickEntryCommand[] = [];
  const quarantined: unknown[] = [];
  const seen = new Set(next.map((entry) => entry.id));
  for (const candidate of commands) {
    const error = validateQuickEntryCommand(candidate);
    if (error) {
      quarantined.push(candidate);
      continue;
    }
    const command = candidate as QuickEntryCommand;
    const transaction = transactionFromQuickEntryCommand(command);
    if (seen.has(transaction.id)) continue;
    seen.add(transaction.id);
    next.push(transaction);
    applied.push(command);
  }
  return { entries: next, applied, quarantined };
}
