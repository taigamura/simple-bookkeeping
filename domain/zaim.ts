/**
 * Zaim CSV import — pure parsing (slices #12–#13, PRD #11). `decodeZaimBytes`
 * turns a Zaim export's raw file bytes into text; `parseZaimCsv` turns that
 * text's payment/income rows into kaji entries, skipping transfer,
 * balance-adjustment, and malformed rows with a reason tally. No React Native
 * or storage here — same shape as the other domain modules (`categories`,
 * `recurrence`).
 *
 * A UTF-8 decode fallback is #14 — extends this module without reshaping it.
 */
import * as Encoding from 'encoding-japanese';

import { addCategory } from './categories';
import { uid } from './entries';
import type { Transaction, TxType } from './types';

/** Zaim's CSV header, in column order — validated against the decoded file. */
const ZAIM_HEADER = [
  '日付',
  '方法',
  'カテゴリ',
  'カテゴリの内訳',
  '支払元',
  '入金先',
  '品目',
  'メモ',
  'お店',
  '通貨',
  '収入',
  '支出',
  '振替',
  '残高調整',
];

/** Values Zaim writes into a blank cell — dropped when composing the note. */
const BLANK_VALUES = new Set(['', '-', '−', '—']);

/**
 * Decode raw file bytes as Shift-JIS (Zaim's default export encoding) and
 * validate the decoded header row against `ZAIM_HEADER`. Returns the decoded
 * text on a match, or `null` when it doesn't look like a Zaim export (the
 * UTF-8 retry lands in a later slice).
 */
export function decodeZaimBytes(bytes: Uint8Array): string | null {
  const text = Encoding.convert(bytes, { to: 'UNICODE', from: 'SJIS', type: 'string' });
  return hasZaimHeader(text) ? text : null;
}

function hasZaimHeader(text: string): boolean {
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0] ?? '';
  const cols = parseCsvLine(firstLine);
  return ZAIM_HEADER.every((col, i) => cols[i] === col);
}

/** The two category lists to reconcile new Zaim categories against. */
export interface ZaimCategories {
  expCats: string[];
  incCats: string[];
}

/** Why a row was excluded from the imported entries. */
export type ZaimSkipReason = 'transfer' | 'balanceAdjustment' | 'malformed';

/** Count of skipped rows, broken down by `ZaimSkipReason`. */
export interface ZaimSkipTally {
  transfer: number;
  balanceAdjustment: number;
  malformed: number;
}

/** Parsed entries plus the (possibly grown) category lists and skip tally. */
export interface ZaimImportResult {
  entries: Transaction[];
  expCats: string[];
  incCats: string[];
  skipped: ZaimSkipTally;
}

/**
 * Parse a decoded Zaim CSV export. Each `payment` row becomes an expense
 * entry, each `income` row an income entry; the row's top-level category is
 * reconciled against `existing` (case-insensitive match reuses it, otherwise
 * it's appended). Transfer rows (money moved between the user's own
 * accounts — kaji has no multi-account model), balance-adjustment rows, and
 * malformed rows (bad date, non-numeric amount, missing category) are
 * excluded from `entries` and counted in `skipped` by reason; a bad row never
 * aborts the rest of the file.
 */
export function parseZaimCsv(csvText: string, existing: ZaimCategories): ZaimImportResult {
  const lines = csvText.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
  const rows = lines.slice(1); // drop the header row

  let expCats = existing.expCats;
  let incCats = existing.incCats;
  const entries: Transaction[] = [];
  const skipped: ZaimSkipTally = { transfer: 0, balanceAdjustment: 0, malformed: 0 };

  for (const line of rows) {
    const result = readRow(parseCsvLine(line));
    if (result.kind === 'skip') {
      skipped[result.reason]++;
      continue;
    }

    const row = result.row;
    if (row.type === 'expense') {
      expCats = addCategory(expCats, row.category);
    } else {
      incCats = addCategory(incCats, row.category);
    }

    entries.push({
      id: uid(),
      y: row.y,
      m: row.m,
      day: row.day,
      type: row.type,
      amount: row.amount,
      category: row.category,
      note: composeNote(row),
      repeat: 'never',
    });
  }

  return { entries, expCats, incCats, skipped };
}

interface ParsedRow {
  y: number;
  m: number;
  day: number;
  type: TxType;
  amount: number;
  category: string;
  subCategory: string;
  item: string;
  memo: string;
  shop: string;
}

/** Column indices in `ZAIM_HEADER` order. */
const COL = {
  date: 0,
  category: 2,
  subCategory: 3,
  item: 6,
  memo: 7,
  shop: 8,
  income: 10,
  expense: 11,
  transfer: 12,
  balanceAdjustment: 13,
};

type RowResult = { kind: 'entry'; row: ParsedRow } | { kind: 'skip'; reason: ZaimSkipReason };

function readRow(cols: string[]): RowResult {
  // Transfer and balance-adjustment rows carry their amount in their own
  // dedicated column rather than 収入/支出 — checked first since such rows
  // also tend to leave カテゴリ blank, which would otherwise read as malformed.
  if (parseAmount(cols[COL.transfer]) !== null) {
    return { kind: 'skip', reason: 'transfer' };
  }
  if (parseAmount(cols[COL.balanceAdjustment]) !== null) {
    return { kind: 'skip', reason: 'balanceAdjustment' };
  }

  const date = parseZaimDate(cols[COL.date]);
  const category = cleanField(cols[COL.category]);
  if (!date || !category) return { kind: 'skip', reason: 'malformed' };

  const expense = parseAmount(cols[COL.expense]);
  const income = parseAmount(cols[COL.income]);

  let type: TxType;
  let amount: number;
  if (expense !== null && expense > 0) {
    type = 'expense';
    amount = expense;
  } else if (income !== null && income > 0) {
    type = 'income';
    amount = income;
  } else {
    return { kind: 'skip', reason: 'malformed' };
  }

  return {
    kind: 'entry',
    row: {
      ...date,
      type,
      amount,
      category,
      subCategory: cleanField(cols[COL.subCategory]),
      item: cleanField(cols[COL.item]),
      memo: cleanField(cols[COL.memo]),
      shop: cleanField(cols[COL.shop]),
    },
  };
}

function parseZaimDate(value: string | undefined): { y: number; m: number; day: number } | null {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec((value ?? '').trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (m < 0 || m > 11 || day < 1 || day > 31) return null;
  return { y, m, day };
}

function parseAmount(value: string | undefined): number | null {
  const cleaned = cleanField(value);
  if (!cleaned) return null;
  const n = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Trim a field and drop Zaim's blank-cell placeholders down to `''`. */
function cleanField(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  return BLANK_VALUES.has(trimmed) ? '' : trimmed;
}

/** Sub-category / item / memo / shop, joined; falls back to the category. */
function composeNote(row: ParsedRow): string {
  const parts = [row.subCategory, row.item, row.memo, row.shop].filter((p) => p !== '');
  return parts.length > 0 ? parts.join(' / ') : row.category;
}

/** Minimal CSV line splitter: handles quoted fields, commas, and "" escapes. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}
