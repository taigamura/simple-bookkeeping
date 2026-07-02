/**
 * Seed values for a fresh ledger (decision 8: first launch is empty — no
 * transactions, only default categories). Categories are editable in Settings
 * (slice #7); currency defaults to ¥ JPY until the currency picker lands.
 */
import type { Currency } from './types';

export const DEFAULT_EXP_CATS = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
];

export const DEFAULT_INC_CATS = ['Salary', 'Bonus', 'Gift', 'Other'];

export const DEFAULT_CURRENCY: Currency = { symbol: '¥', code: 'JPY' };
