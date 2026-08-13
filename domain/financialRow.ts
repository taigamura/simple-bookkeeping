import { daysInMonth } from './calendar';
import type { TxType } from './types';

/** The provider-independent fields that must be safe before entering the ledger. */
export interface FinancialRow {
  y: unknown;
  m: unknown;
  day: unknown;
  type: unknown;
  amount: unknown;
  category: unknown;
}

export type FinancialRowInvalidReason =
  | 'invalidDate'
  | 'invalidAmount'
  | 'emptyCategory'
  | 'unsupportedType'
  | 'outOfRange';

export type FinancialRowValidation =
  | { valid: true; row: { y: number; m: number; day: number; type: TxType; amount: number; category: string } }
  | { valid: false; reason: FinancialRowInvalidReason };

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

/**
 * Validate the financial part of an imported row at the provider boundary.
 * Keep this independent of CSV shape so every future provider can use the
 * same safety rules before it changes categories or the saved ledger.
 */
export function validateFinancialRow(row: FinancialRow): FinancialRowValidation {
  if (
    typeof row.y !== 'number' || !Number.isInteger(row.y) ||
    typeof row.m !== 'number' || !Number.isInteger(row.m) ||
    typeof row.day !== 'number' || !Number.isInteger(row.day)
  ) {
    return { valid: false, reason: 'invalidDate' };
  }
  if (row.y < MIN_YEAR || row.y > MAX_YEAR) {
    return { valid: false, reason: 'outOfRange' };
  }
  if (row.m < 0 || row.m > 11) {
    return { valid: false, reason: 'invalidDate' };
  }
  if (row.day < 1 || row.day > daysInMonth(row.y, row.m)) {
    return { valid: false, reason: 'invalidDate' };
  }

  if (row.type !== 'income' && row.type !== 'expense') {
    return { valid: false, reason: 'unsupportedType' };
  }
  if (typeof row.amount !== 'number' || !Number.isFinite(row.amount) || !Number.isInteger(row.amount)) {
    return { valid: false, reason: 'invalidAmount' };
  }
  if (!Number.isSafeInteger(row.amount) || row.amount <= 0) {
    return { valid: false, reason: 'outOfRange' };
  }
  if (typeof row.category !== 'string' || row.category.trim() === '') {
    return { valid: false, reason: 'emptyCategory' };
  }

  return {
    valid: true,
    row: {
      y: row.y,
      m: row.m,
      day: row.day,
      type: row.type,
      amount: row.amount,
      category: row.category.trim(),
    },
  };
}
