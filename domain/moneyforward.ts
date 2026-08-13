/**
 * Strict adapter for the verified MoneyForward ME web-monthly CSV export.
 *
 * The documented app and PayPay formats are deliberately not accepted here.
 * This adapter recognizes only the ten-column web schema captured in
 * docs/moneyforward-me-csv-contract.md.
 */
import * as Encoding from 'encoding-japanese';

import type { AdapterParseResult, ImportAdapter, ImportSkipReason, NormalizedImportRow } from './importPipeline';

const MONEYFORWARD_HEADER = [
  '計算対象', '日付', '内容', '金額（円）', '保有金融機関',
  '大項目', '中項目', 'メモ', '振替', 'ID',
];

type SkipTally = Partial<Record<ImportSkipReason, number>>;

export const moneyforwardMeImportAdapter: ImportAdapter = {
  provider: 'moneyforward-me',
  decode: decodeMoneyforwardMeBytes,
  detect: (source) => hasMoneyforwardMeHeader(source) ? 'match' : 'no-match',
  parse: parseMoneyforwardMeCsv,
};

/**
 * CP932 is the verified download encoding. UTF-8 is accepted only for the
 * checked-in synthetic fixture and exports explicitly re-saved as UTF-8; both
 * candidates must independently pass the exact header check.
 */
export function decodeMoneyforwardMeBytes(bytes: Uint8Array): string | null {
  const cp932 = Encoding.convert(bytes, { to: 'UNICODE', from: 'SJIS', type: 'string' });
  if (hasMoneyforwardMeHeader(cp932)) return stripBom(cp932);

  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return hasMoneyforwardMeHeader(utf8) ? stripBom(utf8) : null;
  } catch {
    return null;
  }
}

function hasMoneyforwardMeHeader(source: string): boolean {
  const header = parseCsvRecords(source)[0];
  if (!header || header.malformed) return false;
  const columns = [...header.columns];
  columns[0] = stripBom(columns[0] ?? '');
  return columns.length === MONEYFORWARD_HEADER.length
    && MONEYFORWARD_HEADER.every((field, index) => columns[index] === field);
}

function parseMoneyforwardMeCsv(source: string, sourceId: string): AdapterParseResult {
  const tally: SkipTally = {};
  const rows: NormalizedImportRow[] = [];
  const records = parseCsvRecords(source);

  for (let index = 1; index < records.length; index++) {
    const record = records[index];
    if (record.malformed || record.columns.length !== MONEYFORWARD_HEADER.length) {
      increment(tally, 'malformed');
      continue;
    }

    const [included, date, content, signedAmount, _institution, major, minor, memo, transfer] = record.columns;
    if (included.trim() !== '1') {
      increment(tally, 'unsupportedField');
      continue;
    }
    if (transfer.trim() !== '0') {
      increment(tally, 'transfer');
      continue;
    }

    const amount = parseSignedYen(signedAmount);
    if (amount === null) {
      increment(tally, 'invalidAmount');
      continue;
    }

    const parsedDate = parseDate(date);
    if (!parsedDate) {
      increment(tally, 'invalidDate');
      continue;
    }

    const category = (minor.trim() || major.trim());
    const isIncome = amount > 0;
    // A positive value is only evidenced as income when the major category is
    // explicitly 収入. This prevents refund-shaped rows from becoming income.
    if (isIncome && major.trim() !== '収入') {
      increment(tally, 'unsupportedType');
      continue;
    }

    rows.push({
      y: parsedDate.y,
      m: parsedDate.m,
      day: parsedDate.day,
      type: isIncome ? 'income' : 'expense',
      amount: Math.abs(amount),
      category,
      note: composeNote(content, memo, category),
      currencyCode: 'JPY',
      provenance: { provider: 'moneyforward-me', sourceId, row: index - 1 },
    });
  }
  return { kind: 'rows', rows, tally };
}

function parseDate(value: string): { y: number; m: number; day: number } | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, day: Number(match[3]) } : null;
}

function parseSignedYen(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return Number.isSafeInteger(amount) && amount !== 0 ? amount : null;
}

function composeNote(content: string, memo: string, category: string): string {
  const parts = [content.trim(), memo.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : category;
}

function increment(tally: SkipTally, reason: ImportSkipReason): void {
  tally[reason] = (tally[reason] ?? 0) + 1;
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '');
}

interface CsvRecord { columns: string[]; malformed: boolean; }

/** RFC-4180 reader that keeps malformed quoting explicit. */
function parseCsvRecords(source: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let columns: string[] = [];
  let field = '';
  let inQuotes = false;
  let malformed = false;

  const finishRecord = () => {
    columns.push(field);
    if (columns.length > 1 || columns[0] !== '') records.push({ columns, malformed });
    columns = [];
    field = '';
    malformed = false;
  };

  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') { field += '"'; index++; }
        else inQuotes = false;
      } else field += character;
      continue;
    }
    if (character === '"') {
      if (field !== '') malformed = true;
      inQuotes = true;
    } else if (character === ',') {
      columns.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      finishRecord();
      if (character === '\r' && source[index + 1] === '\n') index++;
    } else field += character;
  }
  if (inQuotes) malformed = true;
  if (field !== '' || columns.length > 0 || malformed) finishRecord();
  return records;
}
