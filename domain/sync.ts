/**
 * The first nearby-household sync tracer bullet.
 *
 * Operations are deliberately small and transport-agnostic. A transport may
 * duplicate, delay, or reorder them; applying an operation is pure and the
 * returned ledger plus sync metadata form one atomic snapshot.
 */
import { daysInMonth } from './calendar';
import { CURRENCIES } from './categories';
import type { Currency, RecurrenceDate, RecurrenceRule, Transaction, TxType } from './types';

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
  /** Immutable seed values used when the accepted operation set is re-reduced. */
  baseCategories: SharedCategory[];
  baseCurrency: Currency;
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
  /** Accepted operations are retained so materialization is delivery-order independent. */
  operations: HouseholdConfigOperation[];
  /** Operation-bearing audit history used to recover prior household values. */
  history: HouseholdConfigHistoryEntry[];
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

export interface HouseholdConfigHistoryEntry {
  operationId: string;
  actorId: ActorId;
  sequence: number;
  version: VersionVector;
  kind: HouseholdConfigOperation['kind'];
  field: string;
  value: SharedCategory | string | number | Currency | null;
}

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

export interface SyncBatchPreview {
  operationIds: string[];
  added: string[];
  edited: string[];
  deleted: string[];
}

/** Metadata retained by the caller so a committed merge can be recovered byte-for-byte. */
export interface SyncRollbackMetadata {
  preMergeState: string;
  operationIds: string[];
  preview: SyncBatchPreview;
}

export type SyncValidationError =
  | 'invalid-state'
  | 'invalid-operation'
  | 'wrong-household'
  | 'invalid-actor'
  | 'invalid-sequence'
  | 'invalid-version'
  | 'invalid-transaction';

/** A recurrence rule is a replicated household record, separate from entries. */
export interface AddRecurrenceRuleOperation {
  kind: 'add-recurrence-rule';
  operationId: string; householdId: HouseholdId; actorId: ActorId;
  sequence: number; version: VersionVector; rule: RecurrenceRule;
}
export interface EditRecurrenceRuleOperation extends Omit<AddRecurrenceRuleOperation, 'kind' | 'rule'> {
  kind: 'edit-recurrence-rule'; ruleId: string; rule: RecurrenceRule;
}
export interface ExceptionRecurrenceOperation extends Omit<AddRecurrenceRuleOperation, 'kind' | 'rule'> {
  kind: 'exception-recurrence'; ruleId: string; scheduled: RecurrenceDate;
}
export interface SplitRecurrenceRuleOperation extends Omit<AddRecurrenceRuleOperation, 'kind' | 'rule'> {
  kind: 'split-recurrence-rule'; ruleId: string; cutoff: string; rule: RecurrenceRule;
}
export interface DeleteRecurrenceRuleOperation extends Omit<AddRecurrenceRuleOperation, 'kind' | 'rule'> {
  kind: 'delete-recurrence-rule'; ruleId: string;
}
export type RecurrenceSyncOperation = AddRecurrenceRuleOperation | EditRecurrenceRuleOperation
  | ExceptionRecurrenceOperation | SplitRecurrenceRuleOperation | DeleteRecurrenceRuleOperation;

export interface RecurrenceHistoryEntry {
  operationId: string;
  kind: RecurrenceSyncOperation['kind'];
  actorId: ActorId; sequence: number; version: VersionVector;
  rule?: RecurrenceRule;
}

export interface RecurrenceSyncState {
  householdId: HouseholdId;
  rules: RecurrenceRule[];
  versionVector: VersionVector;
  appliedOperations: string[];
  ruleOperations: Record<string, string>;
  history: Record<string, RecurrenceHistoryEntry[]>;
  tombstones: Record<string, Tombstone>;
  /** Exception facts are monotonic, so concurrent one-occurrence edits union. */
  exceptions: Record<string, string[]>;
}

export interface RecurrenceSyncApplyResult {
  state: RecurrenceSyncState; accepted: boolean; error?: SyncValidationError;
}

export interface SyncApplyResult {
  state: SyncState;
  accepted: boolean;
  error?: SyncValidationError;
  failedOperationId?: string;
  rollback?: SyncRollbackMetadata;
  preview?: SyncBatchPreview;
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
  if (!isId(householdId) || new Set(categories.map((category) => category.id)).size !== categories.length
    || !categories.every((category) => isId(category.id)
    && typeof category.label === 'string' && category.label.length > 0
    && (category.type === 'income' || category.type === 'expense')) || !isCurrency(currency)) {
    throw new Error('Invalid household configuration');
  }
  const baseCategories = [...categories].sort((a, b) => a.id.localeCompare(b.id));
  return {
    householdId, baseCategories, baseCurrency: currency, categories: [...baseCategories], budgets: {}, totalBudget: 0, currency,
    versionVector: {}, appliedOperations: [], categoryHistory: {}, budgetHistory: {},
    totalBudgetHistory: [], currencyHistory: [currency], deletedCategories: {}, fieldOperations: {},
    operations: [], history: [],
  };
}

function validConfigState(state: HouseholdConfigState): boolean {
  const validCategory = (category: SharedCategory) => isId(category.id) && typeof category.label === 'string'
    && category.label.length > 0 && (category.type === 'income' || category.type === 'expense');
  return isId(state.householdId) && Array.isArray(state.baseCategories)
    && new Set(state.baseCategories.map((category) => category.id)).size === state.baseCategories.length
    && state.baseCategories.every(validCategory) && isCurrency(state.baseCurrency)
    && Array.isArray(state.categories) && state.categories.every(validCategory)
    && new Set(state.categories.map((category) => category.id)).size === state.categories.length
    && isCurrency(state.currency) && isVersionVector(state.versionVector)
    && isRecord(state.budgets) && Object.entries(state.budgets).every(([id, amount]) => isId(id) && isInteger(amount) && amount > 0)
    && isInteger(state.totalBudget) && state.totalBudget >= 0
    && Array.isArray(state.appliedOperations) && state.appliedOperations.every(isId)
    && isRecord(state.categoryHistory) && isRecord(state.budgetHistory)
    && Array.isArray(state.totalBudgetHistory) && Array.isArray(state.currencyHistory)
    && isRecord(state.deletedCategories) && isRecord(state.fieldOperations)
    && Array.isArray(state.operations) && state.operations.every((operation) => validateConfigOperation(operation, state.householdId) === null)
    && Array.isArray(state.history);
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
    && (!isInteger(operation.amount) || operation.amount <= 0)) return 'invalid-operation';
  if (kind === 'set-total-budget' && (!isInteger(operation.amount) || operation.amount < 0)) return 'invalid-operation';
  if (kind === 'set-currency' && !isCurrency(operation.currency)) return 'invalid-operation';
  return null;
}

function configOperationWins(incoming: HouseholdConfigOperation, prior?: HouseholdConfigOperation): boolean {
  if (!prior) return true;
  if (vectorDominates(incoming.version, prior.version)) return true;
  if (vectorDominates(prior.version, incoming.version)) return false;
  return incoming.operationId < prior.operationId;
}

function configHistoryEntry(operation: HouseholdConfigOperation): HouseholdConfigHistoryEntry {
  let value: HouseholdConfigHistoryEntry['value'];
  switch (operation.kind) {
    case 'add-category': value = operation.category; break;
    case 'rename-category': value = operation.label.trim(); break;
    case 'delete-category': value = null; break;
    case 'set-category-budget': value = operation.amount; break;
    case 'set-total-budget': value = operation.amount; break;
    case 'set-currency': value = operation.currency; break;
  }
  return {
    operationId: operation.operationId,
    actorId: operation.actorId,
    sequence: operation.sequence,
    version: cloneVector(operation.version),
    kind: operation.kind,
    field: configField(operation),
    value,
  };
}

function materializeHouseholdConfig(state: HouseholdConfigState, operations: HouseholdConfigOperation[]): HouseholdConfigState {
  const ordered = [...operations].sort((a, b) => a.operationId.localeCompare(b.operationId));
  const winner = (matching: HouseholdConfigOperation[]) => matching.reduce<HouseholdConfigOperation | undefined>(
    (current, candidate) => configOperationWins(candidate, current) ? candidate : current,
    undefined,
  );
  const categoryIds = new Set(state.baseCategories.map((category) => category.id));
  for (const operation of ordered) {
    if (operation.kind === 'add-category') categoryIds.add(operation.category.id);
    else if ('categoryId' in operation) categoryIds.add(operation.categoryId);
  }
  const categories: SharedCategory[] = [];
  const budgets: Record<string, number> = {};
  const deletedCategories: Record<string, string> = {};
  const fieldOperations: Record<string, string> = {};
  const categoryHistory: Record<string, SharedCategory[]> = {};
  const budgetHistory: Record<string, number[]> = {};

  for (const categoryId of categoryIds) {
    const base = state.baseCategories.find((category) => category.id === categoryId);
    const adds = ordered.filter((operation): operation is AddCategoryOperation => operation.kind === 'add-category' && operation.category.id === categoryId);
    const addWinner = winner(adds) as AddCategoryOperation | undefined;
    const seed = addWinner?.category ?? base;
    const deletes = ordered.filter((operation): operation is DeleteCategoryOperation => operation.kind === 'delete-category' && operation.categoryId === categoryId);
    const deleteWinner = winner(deletes) as DeleteCategoryOperation | undefined;
    const renames = ordered.filter((operation): operation is RenameCategoryOperation => operation.kind === 'rename-category' && operation.categoryId === categoryId);
    const renameWinner = winner(renames) as RenameCategoryOperation | undefined;
    const budgetOperations = ordered.filter((operation): operation is SetCategoryBudgetOperation => operation.kind === 'set-category-budget' && operation.categoryId === categoryId);
    const budgetWinner = winner(budgetOperations) as SetCategoryBudgetOperation | undefined;

    const history = [
      ...(base ? [base] : []),
      ...adds.map((operation) => operation.category),
      ...(seed ? renames.map((operation) => ({ ...seed, label: operation.label.trim() })) : []),
    ].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
    if (history.length > 0) categoryHistory[categoryId] = history;
    const budgetValues = budgetOperations.flatMap((operation) => operation.amount === null ? [] : [operation.amount]);
    if (budgetValues.length > 0) budgetHistory[categoryId] = budgetValues.sort((a, b) => a - b);

    if (deleteWinner) {
      deletedCategories[categoryId] = deleteWinner.operationId;
      fieldOperations[configField(deleteWinner)] = deleteWinner.operationId;
      continue;
    }
    if (seed) {
      categories.push(renameWinner ? { ...seed, label: renameWinner.label.trim() } : seed);
      if (addWinner) fieldOperations[configField(addWinner)] = addWinner.operationId;
      if (renameWinner) fieldOperations[configField(renameWinner)] = renameWinner.operationId;
      if (budgetWinner) {
        fieldOperations[configField(budgetWinner)] = budgetWinner.operationId;
        if (budgetWinner.amount !== null) budgets[categoryId] = budgetWinner.amount;
      }
    }
  }

  const totalBudgetOperations = ordered.filter((operation): operation is SetTotalBudgetOperation => operation.kind === 'set-total-budget');
  const totalBudgetWinner = winner(totalBudgetOperations) as SetTotalBudgetOperation | undefined;
  const currencyOperations = ordered.filter((operation): operation is SetCurrencyOperation => operation.kind === 'set-currency');
  const currencyWinner = winner(currencyOperations) as SetCurrencyOperation | undefined;
  if (totalBudgetWinner) fieldOperations['total-budget'] = totalBudgetWinner.operationId;
  if (currencyWinner) fieldOperations.currency = currencyWinner.operationId;
  const versionVector: VersionVector = {};
  for (const operation of ordered) {
    for (const [actor, sequence] of Object.entries(operation.version)) versionVector[actor] = Math.max(versionVector[actor] ?? 0, sequence);
  }
  return {
    ...state,
    categories: categories.sort((a, b) => a.id.localeCompare(b.id)),
    budgets,
    totalBudget: totalBudgetWinner?.amount ?? 0,
    currency: currencyWinner?.currency ?? state.baseCurrency,
    versionVector,
    appliedOperations: ordered.map((operation) => operation.operationId),
    categoryHistory,
    budgetHistory,
    totalBudgetHistory: totalBudgetOperations.map((operation) => operation.amount),
    currencyHistory: [state.baseCurrency, ...currencyOperations.map((operation) => operation.currency)],
    deletedCategories,
    fieldOperations,
    operations: ordered,
    history: ordered.map(configHistoryEntry),
  };
}

/** Apply shared configuration operations. Device-local preferences never enter this merge. */
export function applyHouseholdConfigOperation(state: HouseholdConfigState, operation: unknown): ConfigApplyResult {
  if (!validConfigState(state)) return { state, accepted: false, error: 'invalid-state' };
  const error = validateConfigOperation(operation, state.householdId);
  if (error) return { state, accepted: false, error };
  const incoming = operation as HouseholdConfigOperation;
  if (state.appliedOperations.includes(incoming.operationId)) return { state, accepted: false };
  return { state: materializeHouseholdConfig(state, [...state.operations, incoming]), accepted: true };
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
export function restoreLocalTransaction(
  state: SyncState,
  actorId: ActorId,
  transactionId: string,
  historyOperationId?: string,
): { operation: AddTransactionOperation; state: SyncState; transaction: Transaction } {
  const tombstone = state.tombstones[transactionId];
  const causallyBeforeDelete = (entry: SyncHistoryEntry) => tombstone
    && Object.entries(entry.version).every(([actor, sequence]) => sequence <= (tombstone.version[actor] ?? 0));
  const selected = historyOperationId
    ? state.history[transactionId]?.find((entry) => entry.operationId === historyOperationId)
    : undefined;
  const prior = selected?.transaction
    ? selected
    : [...(state.history[transactionId] ?? [])].reverse().find((entry) => entry.transaction && causallyBeforeDelete(entry))
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

function transactionChangePreview(before: SyncState, after: SyncState, operationIds: string[]): SyncBatchPreview {
  const beforeIds = new Set(before.entries.map((entry) => entry.id));
  const afterIds = new Set(after.entries.map((entry) => entry.id));
  const beforeById = new Map(before.entries.map((entry) => [entry.id, entry]));
  const afterById = new Map(after.entries.map((entry) => [entry.id, entry]));
  return {
    operationIds: [...operationIds],
    added: [...afterIds].filter((id) => !beforeIds.has(id)).sort(),
    edited: [...afterIds].filter((id) => beforeIds.has(id) && JSON.stringify(beforeById.get(id)) !== JSON.stringify(afterById.get(id))).sort(),
    deleted: [...beforeIds].filter((id) => !afterIds.has(id)).sort(),
  };
}

/** Validate and materialize a complete incoming batch without changing the live state. */
export function stageSyncOperations(state: SyncState, operations: readonly unknown[]): SyncApplyResult {
  if (!validState(state)) return { state, accepted: false, error: 'invalid-state' };
  let current = state;
  const operationIds: string[] = [];
  for (const operation of operations) {
    const error = validateSyncOperation(operation, state.householdId);
    const id = typeof operation === 'object' && operation !== null && 'operationId' in operation
      && typeof operation.operationId === 'string' ? operation.operationId : undefined;
    if (error) return { state, accepted: false, error, ...(id ? { failedOperationId: id } : {}) };
    operationIds.push((operation as SyncOperation).operationId);
    const result = applySyncOperation(current, operation);
    current = result.state;
  }
  const preview = transactionChangePreview(state, current, operationIds);
  return {
    state: current,
    accepted: current !== state,
    preview,
    rollback: { preMergeState: JSON.stringify(state), operationIds, preview },
  };
}

/** Apply a transport batch atomically. A malformed member leaves the exact input object untouched. */
export function applySyncOperations(state: SyncState, operations: readonly unknown[]): SyncApplyResult {
  const staged = stageSyncOperations(state, operations);
  if (staged.error) return staged;
  return staged;
}

/**
 * Build the authenticated operation stream a replacement phone needs. The
 * stream is derived from retained audit history, so a replacement receives
 * tombstones and losing versions as well as the current materialized ledger.
 */
export function createSyncStateTransfer(state: SyncState): SyncOperation[] {
  if (!validState(state)) throw new Error('Invalid sync state');
  return Object.entries(state.history)
    .flatMap(([transactionId, entries]) => entries.map((entry) => entry.kind === 'add-transaction'
      ? {
        kind: 'add-transaction' as const, operationId: entry.operationId, householdId: state.householdId,
        actorId: entry.actorId, sequence: entry.sequence, version: cloneVector(entry.version),
        transaction: entry.transaction!,
      }
      : entry.kind === 'edit-transaction'
        ? {
          kind: 'edit-transaction' as const, operationId: entry.operationId, householdId: state.householdId,
          actorId: entry.actorId, sequence: entry.sequence, version: cloneVector(entry.version),
          transactionId, transaction: entry.transaction!,
        }
        : {
          kind: 'delete-transaction' as const, operationId: entry.operationId, householdId: state.householdId,
          actorId: entry.actorId, sequence: entry.sequence, version: cloneVector(entry.version), transactionId,
        }))
    .sort((left, right) => left.operationId.localeCompare(right.operationId));
}

/** Merge a replacement's authenticated history atomically into the surviving ledger. */
export function applySyncStateTransfer(state: SyncState, operations: readonly unknown[]): SyncApplyResult {
  return stageSyncOperations(state, operations);
}

export function isSyncActorId(value: unknown): value is ActorId { return isId(value); }
export function isSyncHouseholdId(value: unknown): value is HouseholdId { return isId(value); }

function isRecurrenceDate(value: unknown): value is RecurrenceDate {
  return isRecord(value) && isInteger(value.y) && isInteger(value.m) && value.m >= 0 && value.m <= 11
    && isInteger(value.day) && value.day >= 1 && value.day <= daysInMonth(value.y, value.m);
}

function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  if (!isRecord(value) || !isId(value.id) || !isTimestamp(value.timestamp)
    || !isRecurrenceDate(value.start) || !isInteger(value.anchorDay) || value.anchorDay < 1
    || value.type !== 'income' && value.type !== 'expense'
    || !isInteger(value.amount) || value.amount <= 0 || typeof value.category !== 'string'
    || value.category.length === 0 || typeof value.note !== 'string'
    || !['daily', 'monthly', 'yearly'].includes(value.repeat as string)
    || !['after', 'before', 'off'].includes(value.weekendShift as string)
    || !Array.isArray(value.exceptions) || !value.exceptions.every((item) => typeof item === 'string')) return false;
  return value.endsBefore === undefined || (typeof value.endsBefore === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.endsBefore));
}

function recurrenceRuleId(operation: RecurrenceSyncOperation): string {
  return operation.kind === 'add-recurrence-rule' ? operation.rule.id : operation.ruleId;
}

function recurrenceSplitId(ruleId: string, cutoff: string): string {
  return `${ruleId}:split:${cutoff}`;
}

function validateRecurrenceOperation(
  operation: unknown,
  householdId: HouseholdId,
): SyncValidationError | null {
  if (!isRecord(operation) || ![
    'add-recurrence-rule', 'edit-recurrence-rule', 'exception-recurrence',
    'split-recurrence-rule', 'delete-recurrence-rule',
  ].includes(operation.kind as string)) return 'invalid-operation';
  if (operation.householdId !== householdId) return 'wrong-household';
  if (!isId(operation.householdId) || !isId(operation.actorId) || !isInteger(operation.sequence)
    || operation.sequence < 1 || !isVersionVector(operation.version)
    || operation.version[operation.actorId] !== operation.sequence
    || operation.operationId !== operationId(operation.actorId, operation.sequence)) return 'invalid-operation';
  if (operation.kind === 'add-recurrence-rule' && !isRecurrenceRule(operation.rule)) return 'invalid-operation';
  if (operation.kind !== 'add-recurrence-rule' && !isId(operation.ruleId)) return 'invalid-operation';
  if (operation.kind === 'edit-recurrence-rule'
    && (!isRecurrenceRule(operation.rule) || operation.rule.id !== operation.ruleId)) return 'invalid-operation';
  if (operation.kind === 'exception-recurrence'
    && !isRecurrenceDate(operation.scheduled)) return 'invalid-operation';
  if (operation.kind === 'split-recurrence-rule') {
    const cutoff = operation.cutoff;
    const child = operation.rule;
    const sourceId = operation.ruleId;
    if (typeof cutoff !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)
      || !isId(sourceId) || !isRecurrenceRule(child) || child.id !== recurrenceSplitId(sourceId, cutoff)) return 'invalid-operation';
  }
  return null;
}

export function validateRecurrenceSyncOperation(
  operation: unknown,
  householdId?: HouseholdId,
): SyncValidationError | null {
  return validateRecurrenceOperation(operation, householdId ?? (isRecord(operation) && typeof operation.householdId === 'string' ? operation.householdId : ''));
}

function validRecurrenceState(state: RecurrenceSyncState): boolean {
  return isId(state.householdId) && state.rules.every(isRecurrenceRule)
    && isVersionVector(state.versionVector) && Array.isArray(state.appliedOperations)
    && state.appliedOperations.every(isId) && isRecord(state.ruleOperations)
    && isRecord(state.history) && isRecord(state.tombstones) && isRecord(state.exceptions);
}

export function stableOccurrenceId(ruleId: string, scheduled: RecurrenceDate): string {
  if (!isId(ruleId) || !isRecurrenceDate(scheduled)) throw new Error('Invalid occurrence identity');
  return `${ruleId}@${String(scheduled.y).padStart(4, '0')}-${String(scheduled.m + 1).padStart(2, '0')}-${String(scheduled.day).padStart(2, '0')}`;
}

export function createRecurrenceSyncState(
  householdId: HouseholdId,
  rules: RecurrenceRule[] = [],
): RecurrenceSyncState {
  if (!isId(householdId) || !rules.every(isRecurrenceRule)) throw new Error('Invalid recurrence sync state');
  return {
    householdId, rules: [...rules].sort((a, b) => a.id.localeCompare(b.id)), versionVector: {},
    appliedOperations: [], ruleOperations: {}, history: {}, tombstones: {}, exceptions: {},
  };
}

function recurrenceWinner(state: RecurrenceSyncState, id: string, incoming: RecurrenceSyncOperation): boolean {
  const priorId = state.ruleOperations[id];
  if (!priorId) return true;
  const prior = state.history[id]?.find((entry) => entry.operationId === priorId);
  const after = Boolean(prior && vectorDominates(incoming.version, prior.version));
  const before = Boolean(prior && vectorDominates(prior.version, incoming.version));
  return after || (!before && incoming.operationId < priorId);
}

function recurrenceHistoryRule(operation: RecurrenceSyncOperation): RecurrenceRule | undefined {
  if (operation.kind === 'exception-recurrence' || operation.kind === 'delete-recurrence-rule') return undefined;
  return operation.rule;
}

export function applyRecurrenceSyncOperation(
  state: RecurrenceSyncState,
  operation: unknown,
): RecurrenceSyncApplyResult {
  if (!validRecurrenceState(state)) return { state, accepted: false, error: 'invalid-state' };
  const error = validateRecurrenceOperation(operation, state.householdId);
  if (error) return { state, accepted: false, error };
  const incoming = operation as RecurrenceSyncOperation;
  if (state.appliedOperations.includes(incoming.operationId)) return { state, accepted: false };

  const id = recurrenceRuleId(incoming);
  const next: RecurrenceSyncState = {
    ...state, rules: [...state.rules], versionVector: { ...state.versionVector },
    appliedOperations: [...state.appliedOperations, incoming.operationId].sort(),
    ruleOperations: { ...state.ruleOperations }, history: { ...state.history },
    tombstones: { ...state.tombstones }, exceptions: Object.fromEntries(
      Object.entries(state.exceptions).map(([key, values]) => [key, [...values]]),
    ),
  };
  for (const [actor, sequence] of Object.entries(incoming.version)) next.versionVector[actor] = Math.max(next.versionVector[actor] ?? 0, sequence);
  const historyEntry: RecurrenceHistoryEntry = {
    operationId: incoming.operationId, kind: incoming.kind, actorId: incoming.actorId,
    sequence: incoming.sequence, version: cloneVector(incoming.version),
    ...(recurrenceHistoryRule(incoming) ? { rule: recurrenceHistoryRule(incoming) } : {}),
  };
  next.history[id] = [...(next.history[id] ?? []), historyEntry].sort((a, b) => a.operationId.localeCompare(b.operationId));

  if (incoming.kind === 'exception-recurrence') {
    const key = stableOccurrenceId(incoming.ruleId, incoming.scheduled).split('@')[1];
    next.exceptions[id] = [...new Set([...(next.exceptions[id] ?? []), key])].sort();
    next.rules = next.rules.map((rule) => rule.id === id
      ? { ...rule, exceptions: [...new Set([...rule.exceptions, key])].sort() } : rule);
  } else if (incoming.kind === 'delete-recurrence-rule') {
    const prior = next.tombstones[id];
    if (!prior || incoming.operationId < prior.operationId) {
      next.tombstones[id] = { operationId: incoming.operationId, actorId: incoming.actorId, sequence: incoming.sequence, version: cloneVector(incoming.version) };
    }
    next.rules = next.rules.filter((rule) => rule.id !== id);
    next.ruleOperations[id] = next.tombstones[id].operationId;
  } else if (!next.tombstones[id] && recurrenceWinner(next, id, incoming)) {
    const rule = { ...incoming.rule, exceptions: [...new Set([...(incoming.rule.exceptions ?? []), ...(next.exceptions[id] ?? [])])].sort() };
    if (incoming.kind === 'split-recurrence-rule') {
      // A split is one deterministic fact: truncate the source and create the
      // child whose identity is derived from source + cutoff. The child rule
      // is independently conflict-ordered, so delivery order cannot duplicate
      // or fork a household segment.
      next.rules = next.rules.map((item) => item.id === incoming.ruleId
        ? { ...item, endsBefore: incoming.cutoff } : item);
      next.ruleOperations[incoming.ruleId] = incoming.operationId;
      if (!next.rules.some((item) => item.id === incoming.ruleId)) {
        const source = next.history[incoming.ruleId]?.find((entry) => entry.rule)?.rule;
        if (source) next.rules.push({ ...source, endsBefore: incoming.cutoff });
      }
      const childPrior = next.ruleOperations[rule.id];
      if (!childPrior || incoming.operationId < childPrior) {
        next.rules = [...next.rules.filter((item) => item.id !== rule.id), rule];
        next.ruleOperations[rule.id] = incoming.operationId;
      }
    } else {
      next.rules = [...next.rules.filter((item) => item.id !== id), rule];
      next.ruleOperations[id] = incoming.operationId;
    }
  }
  next.rules.sort((a, b) => a.id.localeCompare(b.id));
  return { state: next, accepted: true };
}

function makeLocalRecurrenceOperation<T extends RecurrenceSyncOperation>(
  state: RecurrenceSyncState,
  actorId: ActorId,
  operation: Omit<T, 'operationId' | 'sequence' | 'version' | 'householdId' | 'actorId'>,
): { operation: T; state: RecurrenceSyncState } {
  if (!validRecurrenceState(state) || !isId(actorId)) throw new Error('Invalid local recurrence operation');
  const sequence = (state.versionVector[actorId] ?? 0) + 1;
  const full = { ...operation, operationId: operationId(actorId, sequence), householdId: state.householdId, actorId, sequence, version: { ...state.versionVector, [actorId]: sequence } } as T;
  const result = applyRecurrenceSyncOperation(state, full);
  if (!result.accepted) throw new Error(result.error ?? 'Unable to apply local recurrence operation');
  return { operation: full, state: result.state };
}

export const addLocalRecurrenceRule = (state: RecurrenceSyncState, actorId: ActorId, rule: RecurrenceRule) => makeLocalRecurrenceOperation<AddRecurrenceRuleOperation>(state, actorId, { kind: 'add-recurrence-rule', rule });
export const editLocalRecurrenceRule = (state: RecurrenceSyncState, actorId: ActorId, rule: RecurrenceRule) => makeLocalRecurrenceOperation<EditRecurrenceRuleOperation>(state, actorId, { kind: 'edit-recurrence-rule', ruleId: rule.id, rule });
export const addRecurrenceException = (state: RecurrenceSyncState, actorId: ActorId, ruleId: string, scheduled: RecurrenceDate) => makeLocalRecurrenceOperation<ExceptionRecurrenceOperation>(state, actorId, { kind: 'exception-recurrence', ruleId, scheduled });
export const splitLocalRecurrenceRule = (state: RecurrenceSyncState, actorId: ActorId, ruleId: string, cutoff: string, rule: Omit<RecurrenceRule, 'id'>) => makeLocalRecurrenceOperation<SplitRecurrenceRuleOperation>(state, actorId, { kind: 'split-recurrence-rule', ruleId, cutoff, rule: { ...rule, id: recurrenceSplitId(ruleId, cutoff) } });
export const deleteLocalRecurrenceRule = (state: RecurrenceSyncState, actorId: ActorId, ruleId: string) => makeLocalRecurrenceOperation<DeleteRecurrenceRuleOperation>(state, actorId, { kind: 'delete-recurrence-rule', ruleId });

export function applyRecurrenceSyncOperations(state: RecurrenceSyncState, operations: readonly unknown[]): RecurrenceSyncApplyResult {
  let current = state; let accepted = false;
  for (const operation of operations) { const result = applyRecurrenceSyncOperation(current, operation); current = result.state; accepted ||= result.accepted; }
  return { state: current, accepted };
}
