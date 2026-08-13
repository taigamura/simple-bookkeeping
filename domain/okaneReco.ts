/**
 * Conservative おカネレコ transaction-detail CSV adapter.
 *
 * This intentionally accepts only the evidence-backed seven-column UTF-8
 * detail export. It does not guess at summary exports, provider backups, or
 * semantics absent from the export contract.
 */
import type { AdapterParseResult, ImportAdapter, NormalizedImportRow } from './importPipeline';

const OKANE_RECO_HEADER = ['DATE', 'TIME', 'CATEGORY', 'CURRENCY', 'PRICE', 'MEMO', 'PAYMENT'];
const INCOME_CATEGORY = '収入';

type SkipTally = Partial<Record<import('./importPipeline').ImportSkipReason, number>>;

export const okaneRecoImportAdapter: ImportAdapter = {
  provider: 'okane-reco',
  decode: decodeOkaneRecoBytes,
  detect: (source) => hasOkaneRecoHeader(source) ? 'match' : 'no-match',
  parse: parseOkaneRecoCsv,
};

/** Only UTF-8 is evidenced for this export. Invalid byte sequences fail closed. */
export function decodeOkaneRecoBytes(bytes: Uint8Array): string | null {
  try {
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return hasOkaneRecoHeader(source) ? source : null;
  } catch {
    return null;
  }
}

function hasOkaneRecoHeader(source: string): boolean {
  const firstRecord = parseCsvRecords(source)[0];
  if (!firstRecord || firstRecord.malformed) return false;
  const columns = firstRecord.columns;
  // A UTF-8 BOM is a transport marker, not a provider field.
  columns[0] = columns[0]?.replace(/^\uFEFF/, '') ?? '';
  return columns.length === OKANE_RECO_HEADER.length
    && OKANE_RECO_HEADER.every((header, index) => columns[index] === header);
}

function parseOkaneRecoCsv(source: string, sourceId: string): AdapterParseResult {
  const records = parseCsvRecords(source);
  const tally: SkipTally = {};
  const rows: NormalizedImportRow[] = [];

  for (let index = 1; index < records.length; index++) {
    const record = records[index];
    if (record.malformed || record.columns.length !== OKANE_RECO_HEADER.length) {
      increment(tally, 'malformed');
      continue;
    }

    const [date, time, category, currency, price, memo, payment] = record.columns;
    // TIME and PAYMENT are observed fields, but neither has ledger semantics.
    // Validate their basic observed shape so a shifted/partial row cannot enter.
    if (!/^\d{2}:\d{2}$/.test(time.trim()) || payment.trim() === '') {
      increment(tally, 'malformed');
      continue;
    }
    if (currency.trim() !== '¥') {
      increment(tally, 'currencyMismatch');
      continue;
    }

    const parsedDate = parseDate(date);
    const parsedAmount = parsePrice(price);
    rows.push({
      y: parsedDate?.y ?? Number.NaN,
      m: parsedDate?.m ?? Number.NaN,
      day: parsedDate?.day ?? Number.NaN,
      type: category.trim() === INCOME_CATEGORY ? 'income' : 'expense',
      amount: parsedAmount,
      category: category.trim(),
      note: memo.trim(),
      currencyCode: 'JPY',
      provenance: { provider: 'okane-reco', sourceId, row: index - 1 },
    });
  }

  return { kind: 'rows', rows, tally };
}

function parseDate(value: string): { y: number; m: number; day: number } | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, day: Number(match[3]) };
}

function parsePrice(value: string): number {
  const trimmed = value.trim();
  // The evidenced export uses unsigned positive integer yen values. Keep bad
  // values as NaN so the shared financial boundary gives an explicit tally.
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function increment(tally: SkipTally, reason: keyof SkipTally): void {
  tally[reason] = (tally[reason] ?? 0) + 1;
}

interface CsvRecord {
  columns: string[];
  malformed: boolean;
}

/** Small RFC-4180 reader; malformed quoting is never normalized silently. */
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
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
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
    } else {
      field += character;
    }
  }
  if (inQuotes) malformed = true;
  if (field !== '' || columns.length > 0 || malformed) finishRecord();
  return records;
}
