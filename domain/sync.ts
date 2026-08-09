/**
 * The first nearby-household sync tracer bullet.
 *
 * Operations are deliberately small and transport-agnostic. A transport may
 * duplicate, delay, or reorder them; applying an operation is pure and the
 * returned ledger plus sync metadata form one atomic snapshot.
 */
import { daysInMonth } from './calendar';
import { CURRENCIES } from './categories';
import type { Currency, Transaction, TxType } from './types';

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

export interface EditTransactionOperation extends Omit<AddTransactionOperation, 'kind'> {
  kind: 'edit-transaction';
  transactionId: string;
  transaction: Transaction;
}

export interface DeleteTransactionOperation extends Omit<AddTransactionOperation, 'kind' | 'transaction'> {
  kind: 'delete-transaction';
  transactionId: string;
}

export type SyncOperation = AddTransactionOperation | EditTransactionOperation | DeleteTransactionOperation;

export interface SharedCategory {
  id: string;
  label: string;
  type: TxType;
}

export interface HouseholdConfigState {
  householdId: HouseholdId;
  categories: SharedCategory[];
  budgets: Record<string, number>;
  totalBudget: number;
  currency: Currency;
  versionVector: VersionVector;
  appliedOperations: string[];
  categoryHistory: Record<string, SharedCategory[]>;
  budgetHistory: Record<string, number[]>;
  totalBudgetHistory: number[];
  currencyHistory: Currency[];
  deletedCategories: Record<string, string>;
  fieldOperations: Record<string, string>;
}

export interface AddCategoryOperation {
  kind: 'add-category'; operationId: string; householdId: HouseholdId; actorId: ActorId;
  sequence: number; version: VersionVector; category: SharedCategory;
}
export interface RenameCategoryOperation extends Omit<AddCategoryOperation, 'kind' | 'category'> {
  kind: 'rename-category'; categoryId: string; label: string;
}
export interface DeleteCategoryOperation extends Omit<AddCategoryOperation, 'kind' | 'category'> {
  kind: 'delete-category'; categoryId: string;
}
export interface SetCategoryBudgetOperation extends Omit<AddCategoryOperation, 'kind' | 'category'> {
  kind: 'set-category-budget'; categoryId: string; amount: number | null;
}
export interface SetTotalBudgetOperation extends Omit<AddCategoryOperation, 'kind' | 'category'> {
  kind: 'set-total-budget'; amount: number;
}
export interface SetCurrencyOperation extends Omit<AddCategoryOperation, 'kind' | 'category'> {
  kind: 'set-currency'; currency: Currency;
}
export type HouseholdConfigOperation = AddCategoryOperation | RenameCategoryOperation | DeleteCategoryOperation
  | SetCategoryBudgetOperation | SetTotalBudgetOperation | SetCurrencyOperation;

export interface ConfigApplyResult { state: HouseholdConfigState; accepted: boolean; error?: SyncValidationError; }

export interface TransactionAttribution {
  createdBy: ActorId;
  lastEditedBy: ActorId;
  createdOperationId: string;
  lastOperationId: string;
}

export interface SyncHistoryEntry {
  operationId: string;
  kind: SyncOperation['kind'];
  actorId: ActorId;
  sequence: number;
  version: VersionVector;
  transaction?: Transaction;
}

export interface Tombstone {
  operationId: string;
  actorId: ActorId;
  sequence: number;
  version: VersionVector;
}

export interface SyncState {
  householdId: HouseholdId;
  entries: Transaction[];
  versionVector: VersionVector;
  /** Operation IDs are the replay fence and are persisted with sync metadata. */
  appliedOperations: string[];
  /** Stable transaction identity → the operation that currently wins conflicts. */
  transactionOperations: Record<string, string>;
  /** All accepted versions, including losing edits and deletes, for audit/replay. */
  history: Record<string, SyncHistoryEntry[]>;
  /** A transaction ID present here is permanently removed from the live ledger. */
  tombstones: Record<string, Tombstone>;
  /** Creator and current editor attribution for each transaction identity. */
  attribution: Record<string, TransactionAttribution>;
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

function isCurrency(value: unknown): value is Currency {
  return isRecord(value) && CURRENCIES.some((currency) => currency.code === value.code && currency.symbol === value.symbol);
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

function transactionIdForOperation(operation: SyncOperation): string {
  return operation.kind === 'add-transaction' ? operation.transaction.id : operation.transactionId;
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

function vectorDominates(left: VersionVector, right: VersionVector): boolean {
  const actors = new Set([...Object.keys(left), ...Object.keys(right)]);
  let strictlyGreater = false;
  for (const actor of actors) {
    const leftValue = left[actor] ?? 0;
    const rightValue = right[actor] ?? 0;
    if (leftValue < rightValue) return false;
    strictlyGreater ||= leftValue > rightValue;
  }
  return strictlyGreater;
}

function validState(state: SyncState): boolean {
  return isId(state.householdId)
    && Array.isArray(state.entries)
    && state.entries.every(isTransaction)
    && isVersionVector(state.versionVector)
    && Array.isArray(state.appliedOperations)
    && state.appliedOperations.every(isId)
    && isRecord(state.transactionOperations)
    && Object.entries(state.transactionOperations).every(([transactionId, operationId]) => isId(transactionId) && isId(operationId))
    && isRecord(state.history)
    && Object.entries(state.history).every(([transactionId, entries]) => isId(transactionId) && Array.isArray(entries))
    && isRecord(state.tombstones)
    && Object.entries(state.tombstones).every(([transactionId, tombstone]) => isId(transactionId) && isRecord(tombstone))
    && isRecord(state.attribution)
    && Object.entries(state.attribution).every(([transactionId, attribution]) => isId(transactionId) && isRecord(attribution));
}

/** Validate an operation before it is allowed to affect a live replica. */
export function validateSyncOperation(
  operation: unknown,
  householdId?: HouseholdId,
): SyncValidationError | null {
  if (!isRecord(operation)
    || (operation.kind !== 'add-transaction' && operation.kind !== 'edit-transaction' && operation.kind !== 'delete-transaction')) {
    return 'invalid-operation';
  }
  if (householdId !== undefined && operation.householdId !== householdId) return 'wrong-household';
  if (!isId(operation.householdId) || !isId(operation.actorId)) return 'invalid-actor';
  if (!isInteger(operation.sequence) || operation.sequence < 1) return 'invalid-sequence';
  if (!isVersionVector(operation.version)
    || operation.version[operation.actorId] !== operation.sequence) return 'invalid-version';
  if (operation.operationId !== operationId(operation.actorId, operation.sequence)) return 'invalid-operation';
  if (operation.kind === 'add-transaction') {
    if (!isTransaction(operation.transaction)) return 'invalid-transaction';
  } else {
    if (!isId(operation.transactionId)) return 'invalid-operation';
    if (operation.kind === 'edit-transaction'
      && (!isTransaction(operation.transaction) || operation.transaction.id !== operation.transactionId)) return 'invalid-transaction';
  }
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
    history: {},
    tombstones: {},
    attribution: {},
  };
}

/** Create the shared configuration slice. Category order and presentation are intentionally absent. */
export function createHouseholdConfigState(
  householdId: HouseholdId,
  categories: SharedCategory[] = [],
  currency: Currency = CURRENCIES[0],
): HouseholdConfigState {
  if (!isId(householdId) || !categories.every((category) => isId(category.id)
    && typeof category.label === 'string' && category.label.length > 0
    && (category.type === 'income' || category.type === 'expense')) || !isCurrency(currency)) {
    throw new Error('Invalid household configuration');
  }
  return {
    householdId, categories: [...categories], budgets: {}, totalBudget: 0, currency,
    versionVector: {}, appliedOperations: [], categoryHistory: {}, budgetHistory: {},
    totalBudgetHistory: [], currencyHistory: [currency], deletedCategories: {}, fieldOperations: {},
  };
}

function validConfigState(state: HouseholdConfigState): boolean {
  return isId(state.householdId) && Array.isArray(state.categories)
    && state.categories.every((category) => isId(category.id) && typeof category.label === 'string'
      && category.label.length > 0 && (category.type === 'income' || category.type === 'expense'))
    && isCurrency(state.currency) && isVersionVector(state.versionVector)
    && Array.isArray(state.appliedOperations) && state.appliedOperations.every(isId);
}

function configField(operation: HouseholdConfigOperation): string {
  switch (operation.kind) {
    case 'rename-category': return `category:${operation.categoryId}:label`;
    case 'delete-category': return `category:${operation.categoryId}:delete`;
    case 'set-category-budget': return `budget:${operation.categoryId}`;
    case 'set-total-budget': return 'total-budget';
    case 'set-currency': return 'currency';
    case 'add-category': return `category:${operation.category.id}:add`;
  }
}

function validateConfigOperation(operation: unknown, householdId: HouseholdId): SyncValidationError | null {
  if (!isRecord(operation)) return 'invalid-operation';
  if (operation.householdId !== householdId) return 'wrong-household';
  if (!isId(operation.householdId)
    || !isId(operation.actorId) || !isInteger(operation.sequence) || operation.sequence < 1
    || !isVersionVector(operation.version) || operation.version[operation.actorId] !== operation.sequence
    || operation.operationId !== operationId(operation.actorId, operation.sequence)) return 'invalid-operation';
  const kind = operation.kind;
  if (!['add-category', 'rename-category', 'delete-category', 'set-category-budget', 'set-total-budget', 'set-currency'].includes(kind as string)) return 'invalid-operation';
  if (kind === 'add-category') {
    const category = operation.category as Record<string, unknown>;
    if (!isRecord(category) || !isId(category.id) || typeof category.label !== 'string' || category.label.length === 0
      || (category.type !== 'income' && category.type !== 'expense')) return 'invalid-operation';
  }
  if (kind === 'rename-category' || kind === 'delete-category' || kind === 'set-category-budget') {
    if (!isId(operation.categoryId)) return 'invalid-operation';
  }
  if (kind === 'rename-category' && (typeof operation.label !== 'string' || operation.label.trim().length === 0)) return 'invalid-operation';
  if (kind === 'set-category-budget' && operation.amount !== null
    && (!isInteger(operation.amount) || operation.amount < 0)) return 'invalid-operation';
  if (kind === 'set-total-budget' && (!isInteger(operation.amount) || operation.amount < 0)) return 'invalid-operation';
  if (kind === 'set-currency' && !isCurrency(operation.currency)) return 'invalid-operation';
  return null;
}

function configWins(state: HouseholdConfigState, field: string, incoming: HouseholdConfigOperation): boolean {
  const priorId = state.fieldOperations[field];
  if (!priorId) return true;
  // The operation ID is a stable lexical tie-breaker for concurrent writes.
  // Deletions are handled separately as monotonic remove-wins facts.
  return incoming.operationId < priorId;
}

/** Apply shared configuration operations. Device-local preferences never enter this merge. */
export function applyHouseholdConfigOperation(state: HouseholdConfigState, operation: unknown): ConfigApplyResult {
  if (!validConfigState(state)) return { state, accepted: false, error: 'invalid-state' };
  const error = validateConfigOperation(operation, state.householdId);
  if (error) return { state, accepted: false, error };
  const incoming = operation as HouseholdConfigOperation;
  if (state.appliedOperations.includes(incoming.operationId)) return { state, accepted: false };
  const next: HouseholdConfigState = {
    ...state, categories: [...state.categories], budgets: { ...state.budgets },
    versionVector: { ...state.versionVector }, appliedOperations: [...state.appliedOperations, incoming.operationId].sort(),
    categoryHistory: { ...state.categoryHistory }, budgetHistory: { ...state.budgetHistory },
    totalBudgetHistory: [...state.totalBudgetHistory], currencyHistory: [...state.currencyHistory],
    deletedCategories: { ...state.deletedCategories }, fieldOperations: { ...state.fieldOperations },
  };
  for (const [actor, sequence] of Object.entries(incoming.version)) next.versionVector[actor] = Math.max(next.versionVector[actor] ?? 0, sequence);
  const record = (key: string, value: number | Currency | SharedCategory) => {
    if (typeof value === 'number') next.budgetHistory[key] = [...(next.budgetHistory[key] ?? []), value];
    else if ('code' in value) next.currencyHistory.push(value);
    else next.categoryHistory[key] = [...(next.categoryHistory[key] ?? []), value];
  };
  if (incoming.kind === 'add-category') {
    if (!next.categories.some((category) => category.id === incoming.category.id) && !next.deletedCategories[incoming.category.id]) next.categories.push(incoming.category);
    record(incoming.category.id, incoming.category);
  } else if (incoming.kind === 'delete-category') {
    const priorDelete = next.deletedCategories[incoming.categoryId];
    next.deletedCategories[incoming.categoryId] = priorDelete && priorDelete < incoming.operationId ? priorDelete : incoming.operationId;
    next.categories = next.categories.filter((category) => category.id !== incoming.categoryId);
    next.fieldOperations[configField(incoming)] = next.deletedCategories[incoming.categoryId];
  } else if (incoming.kind === 'rename-category') {
    if (!next.deletedCategories[incoming.categoryId] && configWins(next, configField(incoming), incoming)) {
      next.categories = next.categories.map((category) => category.id === incoming.categoryId ? { ...category, label: incoming.label.trim() } : category);
      next.fieldOperations[configField(incoming)] = incoming.operationId;
    }
    const category = next.categories.find((item) => item.id === incoming.categoryId)
      ?? [...(next.categoryHistory[incoming.categoryId] ?? [])].pop();
    if (category) record(incoming.categoryId, { ...category, label: incoming.label.trim() });
  } else if (incoming.kind === 'set-category-budget') {
    if (!next.deletedCategories[incoming.categoryId] && configWins(next, configField(incoming), incoming)) {
      if (incoming.amount === null) delete next.budgets[incoming.categoryId]; else next.budgets[incoming.categoryId] = incoming.amount;
      next.fieldOperations[configField(incoming)] = incoming.operationId;
    }
    if (incoming.amount !== null) record(incoming.categoryId, incoming.amount);
  } else if (incoming.kind === 'set-total-budget') {
    if (configWins(next, 'total-budget', incoming)) { next.totalBudget = incoming.amount; next.fieldOperations['total-budget'] = incoming.operationId; }
    next.totalBudgetHistory.push(incoming.amount);
  } else if (incoming.kind === 'set-currency') {
    if (configWins(next, 'currency', incoming)) { next.currency = incoming.currency; next.fieldOperations.currency = incoming.operationId; }
    next.currencyHistory.push(incoming.currency);
  }
  for (const history of Object.values(next.categoryHistory)) history.sort((a, b) => a.label.localeCompare(b.label));
  for (const history of Object.values(next.budgetHistory)) history.sort((a, b) => a - b);
  next.currencyHistory.sort((a, b) => `${a.code}:${a.symbol}`.localeCompare(`${b.code}:${b.symbol}`));
  next.categories.sort((a, b) => a.id.localeCompare(b.id));
  return { state: next, accepted: true };
}

function makeConfigOperation<T extends HouseholdConfigOperation>(state: HouseholdConfigState, actorId: ActorId, operation: Omit<T, 'operationId' | 'sequence' | 'version' | 'householdId' | 'actorId'>): { operation: T; state: HouseholdConfigState } {
  if (!validConfigState(state) || !isId(actorId)) throw new Error('Invalid local household configuration');
  const sequence = (state.versionVector[actorId] ?? 0) + 1;
  const full = { ...operation, operationId: operationId(actorId, sequence), householdId: state.householdId, actorId, sequence, version: { ...state.versionVector, [actorId]: sequence } } as T;
  const result = applyHouseholdConfigOperation(state, full);
  if (!result.accepted) throw new Error(result.error ?? 'Unable to apply local household configuration');
  return { operation: full, state: result.state };
}

export const addLocalCategory = (state: HouseholdConfigState, actorId: ActorId, category: SharedCategory) => makeConfigOperation<AddCategoryOperation>(state, actorId, { kind: 'add-category', category });
export const renameLocalCategory = (state: HouseholdConfigState, actorId: ActorId, categoryId: string, label: string) => makeConfigOperation<RenameCategoryOperation>(state, actorId, { kind: 'rename-category', categoryId, label });
export const deleteLocalCategory = (state: HouseholdConfigState, actorId: ActorId, categoryId: string) => makeConfigOperation<DeleteCategoryOperation>(state, actorId, { kind: 'delete-category', categoryId });
export const setLocalCategoryBudget = (state: HouseholdConfigState, actorId: ActorId, categoryId: string, amount: number | null) => makeConfigOperation<SetCategoryBudgetOperation>(state, actorId, { kind: 'set-category-budget', categoryId, amount });
export const setLocalTotalBudget = (state: HouseholdConfigState, actorId: ActorId, amount: number) => makeConfigOperation<SetTotalBudgetOperation>(state, actorId, { kind: 'set-total-budget', amount });
export const setLocalCurrency = (state: HouseholdConfigState, actorId: ActorId, currency: Currency) => makeConfigOperation<SetCurrencyOperation>(state, actorId, { kind: 'set-currency', currency });

export function applyHouseholdConfigOperations(state: HouseholdConfigState, operations: readonly unknown[]): ConfigApplyResult {
  let current = state; let accepted = false;
  for (const operation of operations) { const result = applyHouseholdConfigOperation(current, operation); current = result.state; accepted ||= result.accepted; }
  return { state: current, accepted };
}

/** Create a locally authored add and commit it to the author's replica. */
export function addLocalTransaction(
  state: SyncState,
  actorId: ActorId,
  transaction: Transaction,
): { operation: AddTransactionOperation; state: SyncState } {
  if (!validState(state) || !isId(actorId) || !isTransaction(transaction) || state.tombstones[transaction.id]) throw new Error('Invalid local transaction');
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
  const acceptedOperation = operation as SyncOperation;
  if (state.appliedOperations.includes(acceptedOperation.operationId)) return { state, accepted: false };

  const transactionId = transactionIdForOperation(acceptedOperation);
  const existing = state.entries.find((entry) => entry.id === transactionId);
  const tombstone = state.tombstones[transactionId];
  const priorOperation = state.transactionOperations[transactionId];
  const priorVersion = state.history[transactionId]?.find((entry) => entry.operationId === priorOperation)?.version;
  const incomingAfterPrior = Boolean(priorVersion && vectorDominates(acceptedOperation.version, priorVersion));
  const priorAfterIncoming = Boolean(priorVersion && vectorDominates(priorVersion, acceptedOperation.version));
  // Causality beats the tie-breaker: an actor's later edit must replace its
  // own earlier value. Only concurrent versions use a stable lexical order.
  const incomingWins = !priorOperation || incomingAfterPrior
    || (!priorAfterIncoming && acceptedOperation.operationId < priorOperation);
  const isDelete = acceptedOperation.kind === 'delete-transaction';
  const isAddOrEdit = acceptedOperation.kind !== 'delete-transaction';
  // Deletion is a monotonic fact. Once observed, no delayed edit or add can
  // recreate the record; restore must use a new transaction identity.
  const deleted = Boolean(tombstone) || isDelete;
  let entries = state.entries;
  if (!deleted && isAddOrEdit) {
    entries = existing
      ? (incomingWins
        ? state.entries.map((entry) => entry.id === transactionId ? acceptedOperation.transaction : entry)
        : state.entries)
      : [...state.entries, acceptedOperation.transaction];
  } else if (isDelete && existing) {
    entries = state.entries.filter((entry) => entry.id !== transactionId);
  }
  const versionVector = cloneVector(state.versionVector);
  for (const [actor, sequence] of Object.entries(acceptedOperation.version)) {
    versionVector[actor] = Math.max(versionVector[actor] ?? 0, sequence);
  }
  const historyEntry: SyncHistoryEntry = {
    operationId: acceptedOperation.operationId,
    kind: acceptedOperation.kind,
    actorId: acceptedOperation.actorId,
    sequence: acceptedOperation.sequence,
    version: cloneVector(acceptedOperation.version),
    ...(acceptedOperation.kind !== 'delete-transaction'
      ? { transaction: acceptedOperation.transaction }
      : (() => {
        const prior = [...(state.history[transactionId] ?? [])].reverse().find((entry) => entry.transaction
          && Object.entries(entry.version).every(([actor, sequence]) => sequence <= (acceptedOperation.version[actor] ?? 0)));
        return prior?.transaction ? { transaction: prior.transaction } : existing ? { transaction: existing } : {};
      })()),
  };
  const history = {
    ...state.history,
    [transactionId]: [...(state.history[transactionId] ?? []), historyEntry]
      .sort((a, b) => a.operationId.localeCompare(b.operationId)),
  };
  const nextTombstones = { ...state.tombstones };
  if (isDelete && (!tombstone || acceptedOperation.operationId < tombstone.operationId)) {
    nextTombstones[transactionId] = {
      operationId: acceptedOperation.operationId,
      actorId: acceptedOperation.actorId,
      sequence: acceptedOperation.sequence,
      version: cloneVector(acceptedOperation.version),
    };
  }
  const priorAttribution = state.attribution[transactionId];
  const attribution = { ...state.attribution };
  if (acceptedOperation.kind === 'add-transaction' && !priorAttribution) {
    attribution[transactionId] = {
      createdBy: acceptedOperation.actorId,
      lastEditedBy: acceptedOperation.actorId,
      createdOperationId: acceptedOperation.operationId,
      lastOperationId: acceptedOperation.operationId,
    };
  } else if (isDelete || (!tombstone && incomingWins)) {
    attribution[transactionId] = {
      ...(priorAttribution ?? { createdBy: acceptedOperation.actorId, createdOperationId: acceptedOperation.operationId }),
      lastEditedBy: acceptedOperation.actorId,
      lastOperationId: acceptedOperation.operationId,
    };
  }
  const transactionOperations = {
    ...state.transactionOperations,
    ...(isDelete
      ? { [transactionId]: nextTombstones[transactionId].operationId }
      : (!tombstone && incomingWins ? { [transactionId]: acceptedOperation.operationId } : {})),
  };
  return {
    accepted: true,
    state: {
      householdId: state.householdId,
      entries: [...entries].sort((a, b) => a.id.localeCompare(b.id)),
      versionVector,
      appliedOperations: [...state.appliedOperations, acceptedOperation.operationId].sort(),
      transactionOperations,
      history,
      tombstones: nextTombstones,
      attribution,
    },
  };
}

function makeLocalOperation<T extends SyncOperation>(state: SyncState, actorId: ActorId, operation: Omit<T, 'operationId' | 'sequence' | 'version' | 'householdId' | 'actorId'>): { operation: T; state: SyncState } {
  if (!validState(state) || !isId(actorId)) throw new Error('Invalid local sync operation');
  const sequence = (state.versionVector[actorId] ?? 0) + 1;
  const full = {
    ...operation,
    operationId: operationId(actorId, sequence),
    householdId: state.householdId,
    actorId,
    sequence,
    version: { ...state.versionVector, [actorId]: sequence },
  } as T;
  const result = applySyncOperation(state, full);
  if (!result.accepted) throw new Error(result.error ?? 'Unable to apply local sync operation');
  return { operation: full, state: result.state };
}

export function editLocalTransaction(state: SyncState, actorId: ActorId, transaction: Transaction): { operation: EditTransactionOperation; state: SyncState } {
  if (!state.entries.some((entry) => entry.id === transaction.id) || state.tombstones[transaction.id]) throw new Error('Cannot edit a missing or deleted transaction');
  return makeLocalOperation<EditTransactionOperation>(state, actorId, { kind: 'edit-transaction', transactionId: transaction.id, transaction });
}

export function deleteLocalTransaction(state: SyncState, actorId: ActorId, transactionId: string): { operation: DeleteTransactionOperation; state: SyncState } {
  if (!state.entries.some((entry) => entry.id === transactionId) || state.tombstones[transactionId]) throw new Error('Cannot delete a missing or deleted transaction');
  return makeLocalOperation<DeleteTransactionOperation>(state, actorId, { kind: 'delete-transaction', transactionId });
}

/** Recover the latest prior value under a new ID, leaving the tombstone intact. */
export function restoreLocalTransaction(state: SyncState, actorId: ActorId, transactionId: string): { operation: AddTransactionOperation; state: SyncState; transaction: Transaction } {
  const tombstone = state.tombstones[transactionId];
  const causallyBeforeDelete = (entry: SyncHistoryEntry) => tombstone
    && Object.entries(entry.version).every(([actor, sequence]) => sequence <= (tombstone.version[actor] ?? 0));
  const prior = [...(state.history[transactionId] ?? [])].reverse().find((entry) => entry.transaction && causallyBeforeDelete(entry))
    ?? [...(state.history[transactionId] ?? [])].reverse().find((entry) => entry.transaction);
  if (!prior?.transaction) throw new Error('No recoverable transaction history');
  const sequence = (state.versionVector[actorId] ?? 0) + 1;
  const transaction = { ...prior.transaction, id: `${transactionId}:restore:${actorId}:${sequence}` };
  const result = addLocalTransaction(state, actorId, transaction);
  return { ...result, transaction };
}

/** Roll a live transaction back by emitting a new edit, preserving the audit trail. */
export function rollbackLocalTransaction(
  state: SyncState,
  actorId: ActorId,
  transactionId: string,
  historyOperationId: string,
): { operation: EditTransactionOperation; state: SyncState } {
  if (!state.entries.some((entry) => entry.id === transactionId)) throw new Error('Cannot roll back a missing or deleted transaction');
  const prior = state.history[transactionId]?.find((entry) => entry.operationId === historyOperationId);
  if (!prior?.transaction) throw new Error('No recoverable transaction history');
  return editLocalTransaction(state, actorId, prior.transaction);
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
