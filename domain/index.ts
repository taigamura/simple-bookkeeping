/** Domain layer public surface — types, formatting, aggregation, input rules. */
export type {
  TxType,
  Repeat,
  WeekendShift,
  Transaction,
  RecurrenceDate,
  RecurrenceOccurrence,
  RecurrenceRule,
  Ledger,
  Currency,
  YM,
} from './types';
export {
  DEFAULT_EXP_CATS,
  DEFAULT_INC_CATS,
  DEFAULT_CURRENCY,
} from './defaults';
export { yen, signed, code, MINUS } from './format';
export {
  monthEntries,
  dayEntries,
  dayNet,
  income,
  expense,
  net,
  signedAmount,
  makeEntry,
  updateEntry,
  removeEntry,
  uid,
  type EntryDraft,
} from './entries';
export {
  daysInMonth,
  firstWeekday,
  shiftMonth,
  clampDay,
  WEEKDAYS,
  WEEKDAY_ABBR,
  MONTH_NAMES,
  dayLabel,
} from './calendar';
export {
  categoryBreakdown,
  splitProportions,
  type CategorySlice,
  type Split,
} from './summary';
export {
  activeRecurrences,
  saveLedgerItem,
  entriesForMonth,
  deleteLedgerItem,
  entriesThrough,
  type ActiveRecurrence,
} from './recurrence';
export {
  CURRENCIES,
  addCategory,
  removeCategory,
  moveCategory,
} from './categories';
export {
  setBudget,
  clearBudget,
  hasAnyBudget,
  budgetRemaining,
  pruneBudgets,
  isBudgetActive,
  getRemainingBudget,
  type Budgets,
} from './budgets';
export { sampleEntries } from './sample';
export {
  decodeZaimBytes,
  parseZaimCsv,
  serializeZaimCsv,
  type ZaimExisting,
  type ZaimImportResult,
  type ZaimSkipReason,
  type ZaimSkipTally,
} from './zaim';
export {
  pressKey,
  amountValue,
  AMOUNT_MAX_DIGITS,
  type KeypadKey,
} from './keypad';
