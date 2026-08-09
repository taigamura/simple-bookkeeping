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
export type { CategoryEntity } from './identity';
export { stableId, legacyCategoryId, categoryEntities, legacyCategoryEntities, categoryIdFor, withCategoryId } from './identity';
export {
  DEFAULT_EXP_CATS,
  DEFAULT_INC_CATS,
  DEFAULT_CURRENCY,
} from './defaults';
export { yen, signed, code, stamp, MINUS } from './format';
export { emojiFor, FALLBACK_EMOJI } from './emoji';
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
  CALENDAR_VIEWS,
  isCalendarView,
  type CalendarView,
} from './calendar';
export {
  categoryBreakdown,
  splitProportions,
  SUMMARY_GRANULARITIES,
  isSummaryGranularity,
  periodEntries,
  periodKey,
  periodLabel,
  periodMonths,
  shiftPeriod,
  type CategorySlice,
  type Split,
  type SummaryGranularity,
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
  promoteCategory,
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
  validateFinancialRow,
  type FinancialRow,
  type FinancialRowInvalidReason,
  type FinancialRowValidation,
} from './financialRow';
export {
  pressKey,
  amountValue,
  AMOUNT_MAX_DIGITS,
  type KeypadKey,
} from './keypad';
