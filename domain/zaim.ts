/**
 * Zaim CSV import — pure parsing (slice #12, PRD #11). `decodeZaimBytes` turns
 * a Zaim export's raw file bytes into text; `parseZaimCsv` turns that text's
 * payment/income rows into kaji entries. No React Native or storage here —
 * same shape as the other domain modules (`categories`, `recurrence`).
 *
 * Rows this slice doesn't yet classify (transfers, balance adjustments,
 * malformed rows) are silently dropped; counting them by reason is #13, and a
 * UTF-8 decode fallback is #14 — both extend this module without reshaping it.
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

/** Parsed entries plus the (possibly grown) category lists. */
export interface ZaimImportResult {
  entries: Transaction[];
  expCats: string[];
  incCats: string[];
}

/**
 * Parse a decoded Zaim CSV export. Each `payment` row becomes an expense
 * entry, each `income` row an income entry; the row's top-level category is
 * reconciled against `existing` (case-insensitive match reuses it, otherwise
 * it's appended). Any other row — transfer, balance-adjustment, malformed —
 * is dropped.
 */
export function parseZaimCsv(csvText: string, existing: ZaimCategories): ZaimImportResult {
  const lines = csvText.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
  const rows = lines.slice(1); // drop the header row

  let expCats = existing.expCats;
  let incCats = existing.incCats;
  const entries: Transaction[] = [];

  for (const line of rows) {
    const row = readRow(parseCsvLine(line));
    if (!row) continue;

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

  return { entries, expCats, incCats };
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
};

function readRow(cols: string[]): ParsedRow | null {
  const date = parseZaimDate(cols[COL.date]);
  const category = cleanField(cols[COL.category]);
  if (!date || !category) return null;

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
    return null; // transfer / balance-adjustment / malformed — dropped this slice
  }

  return {
    ...date,
    type,
    amount,
    category,
    subCategory: cleanField(cols[COL.subCategory]),
    item: cleanField(cols[COL.item]),
    memo: cleanField(cols[COL.memo]),
    shop: cleanField(cols[COL.shop]),
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
