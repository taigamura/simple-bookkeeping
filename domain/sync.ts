/**
 * The first nearby-household sync tracer bullet.
 *
 * Operations are deliberately small and transport-agnostic. A transport may
 * duplicate, delay, or reorder them; applying an operation is pure and the
 * returned ledger plus sync metadata form one atomic snapshot.
 */
import { daysInMonth } from './calendar';
import type { Transaction } from './types';

export type ActorId = string;
export type HouseholdId = string;
export type VersionVector = Record<ActorId, number>;

export interface AddTransactionOperation {
  kind: 'add-transaction';
  operationId: string;
  householdId: HouseholdId;
  actorId: ActorId;
  sequence: number;
  version: VersionVector;
  transaction: Transaction;
}

export type SyncOperation = AddTransactionOperation;

export interface SyncState {
  householdId: HouseholdId;
  entries: Transaction[];
  versionVector: VersionVector;
  /** Operation IDs are the replay fence and are persisted with sync metadata. */
  appliedOperations: string[];
  /** Stable transaction identity → the operation that currently wins conflicts. */
  transactionOperations: Record<string, string>;
}

export type SyncValidationError =
  | 'invalid-state'
  | 'invalid-operation'
  | 'wrong-household'
  | 'invalid-actor'
  | 'invalid-sequence'
  | 'invalid-version'
  | 'invalid-transaction';

export interface SyncApplyResult {
  state: SyncState;
  accepted: boolean;
  error?: SyncValidationError;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isVersionVector(value: unknown): value is VersionVector {
  return isRecord(value) && Object.entries(value).every(([actor, sequence]) =>
    isId(actor) && isInteger(sequence) && sequence >= 0,
  );
}

function isTransaction(value: unknown): value is Transaction {
  if (!isRecord(value) || !isId(value.id) || !isTimestamp(value.timestamp)) return false;
  if (!isInteger(value.y) || !isInteger(value.m) || value.m < 0 || value.m > 11) return false;
  if (!isInteger(value.day) || value.day < 1 || value.day > daysInMonth(value.y, value.m)) return false;
  if (value.type !== 'income' && value.type !== 'expense') return false;
  if (!isInteger(value.amount) || value.amount <= 0) return false;
  if (typeof value.category !== 'string' || value.category.length === 0) return false;
  if (typeof value.note !== 'string') return false;
  return value.repeat === undefined || value.repeat === 'never' || value.repeat === 'daily'
    || value.repeat === 'monthly' || value.repeat === 'yearly';
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function operationId(actorId: ActorId, sequence: number): string {
  return `${actorId}:${sequence}`;
}

function cloneVector(vector: VersionVector): VersionVector {
  return { ...vector };
}

function validState(state: SyncState): boolean {
  return isId(state.householdId)
    && Array.isArray(state.entries)
    && state.entries.every(isTransaction)
    && isVersionVector(state.versionVector)
    && Array.isArray(state.appliedOperations)
    && state.appliedOperations.every(isId)
    && isRecord(state.transactionOperations)
    && Object.entries(state.transactionOperations).every(([transactionId, operationId]) => isId(transactionId) && isId(operationId));
}

/** Validate an operation before it is allowed to affect a live replica. */
export function validateSyncOperation(
  operation: unknown,
  householdId?: HouseholdId,
): SyncValidationError | null {
  if (!isRecord(operation) || operation.kind !== 'add-transaction') return 'invalid-operation';
  if (householdId !== undefined && operation.householdId !== householdId) return 'wrong-household';
  if (!isId(operation.householdId) || !isId(operation.actorId)) return 'invalid-actor';
  if (!isInteger(operation.sequence) || operation.sequence < 1) return 'invalid-sequence';
  if (!isVersionVector(operation.version)
    || operation.version[operation.actorId] !== operation.sequence) return 'invalid-version';
  if (operation.operationId !== operationId(operation.actorId, operation.sequence)) return 'invalid-operation';
  if (!isTransaction(operation.transaction)) return 'invalid-transaction';
  return null;
}

export function createSyncState(householdId: HouseholdId, entries: Transaction[] = []): SyncState {
  if (!isId(householdId) || !entries.every(isTransaction)) throw new Error('Invalid sync state');
  return {
    householdId,
    entries: [...entries].sort((a, b) => a.id.localeCompare(b.id)),
    versionVector: {},
    appliedOperations: [],
    transactionOperations: {},
  };
}

/** Create a locally authored add and commit it to the author's replica. */
export function addLocalTransaction(
  state: SyncState,
  actorId: ActorId,
  transaction: Transaction,
): { operation: AddTransactionOperation; state: SyncState } {
  if (!validState(state) || !isId(actorId) || !isTransaction(transaction)) throw new Error('Invalid local transaction');
  const sequence = (state.versionVector[actorId] ?? 0) + 1;
  const operation: AddTransactionOperation = {
    kind: 'add-transaction',
    operationId: operationId(actorId, sequence),
    householdId: state.householdId,
    actorId,
    sequence,
    version: { ...state.versionVector, [actorId]: sequence },
    transaction,
  };
  const result = applySyncOperation(state, operation);
  if (!result.accepted) throw new Error(result.error ?? 'Unable to apply local transaction');
  return { operation, state: result.state };
}

/** Apply one operation. Invalid or foreign operations return the exact input state. */
export function applySyncOperation(state: SyncState, operation: unknown): SyncApplyResult {
  if (!validState(state)) return { state, accepted: false, error: 'invalid-state' };
  const error = validateSyncOperation(operation, state.householdId);
  if (error) return { state, accepted: false, error };
  const acceptedOperation = operation as AddTransactionOperation;
  if (state.appliedOperations.includes(acceptedOperation.operationId)) return { state, accepted: false };

  const existing = state.entries.find((entry) => entry.id === acceptedOperation.transaction.id);
  const priorOperation = state.transactionOperations[acceptedOperation.transaction.id];
  const incomingWins = !priorOperation || acceptedOperation.operationId < priorOperation;
  const entries = existing
    ? (incomingWins
      ? state.entries.map((entry) => entry.id === existing.id ? acceptedOperation.transaction : entry)
      : state.entries)
    : [...state.entries, acceptedOperation.transaction];
  const versionVector = cloneVector(state.versionVector);
  for (const [actor, sequence] of Object.entries(acceptedOperation.version)) {
    versionVector[actor] = Math.max(versionVector[actor] ?? 0, sequence);
  }
  return {
    accepted: true,
    state: {
      householdId: state.householdId,
      entries: [...entries].sort((a, b) => a.id.localeCompare(b.id)),
      versionVector,
      appliedOperations: [...state.appliedOperations, acceptedOperation.operationId].sort(),
      transactionOperations: {
        ...state.transactionOperations,
        ...(incomingWins ? { [acceptedOperation.transaction.id]: acceptedOperation.operationId } : {}),
      },
    },
  };
}

/** Apply a transport batch in arrival order; each operation remains replay-safe. */
export function applySyncOperations(state: SyncState, operations: readonly unknown[]): SyncApplyResult {
  let current = state;
  let accepted = false;
  for (const operation of operations) {
    const result = applySyncOperation(current, operation);
    current = result.state;
    accepted ||= result.accepted;
  }
  return { state: current, accepted };
}

export function isSyncActorId(value: unknown): value is ActorId { return isId(value); }
export function isSyncHouseholdId(value: unknown): value is HouseholdId { return isId(value); }
