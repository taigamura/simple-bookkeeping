/**
 * Provider-neutral import boundary.
 *
 * Adapters only decode and normalize external records. They never create a
 * Transaction or mutate categories. Preview validates, fingerprints, and
 * deduplicates normalized rows; apply performs one all-or-nothing state
 * transition.
 */
import { addCategory } from './categories';
import { stableId } from './identity';
import { validateFinancialRow, type FinancialRowInvalidReason } from './financialRow';
import type { Currency, ImportProvenance, Transaction, TxType } from './types';

export type ImportDetection = 'match' | 'no-match' | 'ambiguous';

export interface ImportAdapter {
  provider: string;
  decode(bytes: Uint8Array): string | null;
  detect(source: string): ImportDetection;
  parse(source: string, sourceId: string): AdapterParseResult;
}

export interface NormalizedImportRow {
  y: number;
  m: number;
  day: number;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  currencyCode?: string;
  provenance: ImportProvenance;
  /** Provider fields deliberately not understood by the ledger. */
  unsupportedFields?: string[];
}

export interface AdapterParseResult {
  kind: 'rows' | 'invalid';
  rows: NormalizedImportRow[];
  tally?: Partial<ImportSkipTally>;
}

export type ImportSkipReason =
  | 'unknownFormat'
  | 'ambiguousFormat'
  | 'malformed'
  | 'transfer'
  | 'balanceAdjustment'
  | 'currencyMismatch'
  | 'unsupportedField'
  | 'invalidDate'
  | 'invalidAmount'
  | 'emptyCategory'
  | 'unsupportedType'
  | 'outOfRange'
  | 'duplicate';

export type ImportSkipTally = Record<ImportSkipReason, number>;

export interface ImportState {
  entries: Transaction[];
  expCats: string[];
  incCats: string[];
}

export interface ImportPreview {
  status: 'ready' | 'no-write';
  provider?: string;
  sourceId: string;
  entries: Transaction[];
  expCats: string[];
  incCats: string[];
  skipped: ImportSkipTally;
  reason?: 'unknownFormat' | 'ambiguousFormat' | 'invalidProviderOutput';
}

const EMPTY_TALLY: ImportSkipTally = {
  unknownFormat: 0, ambiguousFormat: 0, malformed: 0, transfer: 0,
  balanceAdjustment: 0, currencyMismatch: 0, unsupportedField: 0,
  invalidDate: 0, invalidAmount: 0, emptyCategory: 0, unsupportedType: 0,
  outOfRange: 0, duplicate: 0,
};

export function sourceFingerprint(source: string): string {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `import-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function rowKey(row: NormalizedImportRow): string {
  return `${row.provenance.provider}\0${row.provenance.sourceId}\0${row.provenance.row}`;
}

function tallyReason(tally: ImportSkipTally, reason: ImportSkipReason): void {
  tally[reason] += 1;
}

/** Decode, detect, normalize, validate, and preview an import without writes. */
export function previewImport(
  source: string,
  existing: ImportState,
  adapters: ImportAdapter[],
  options: { currency?: Currency; sourceId?: string } = {},
): ImportPreview {
  const sourceId = options.sourceId ?? sourceFingerprint(source);
  const matches = adapters.filter((adapter) => adapter.detect(source) === 'match');
  const ambiguous = adapters.some((adapter) => adapter.detect(source) === 'ambiguous');
  const skipped = { ...EMPTY_TALLY };
  if (ambiguous) {
    tallyReason(skipped, 'ambiguousFormat');
    return { status: 'no-write', sourceId, entries: [], expCats: existing.expCats, incCats: existing.incCats, skipped, reason: 'ambiguousFormat' };
  }
  if (matches.length !== 1) {
    tallyReason(skipped, 'unknownFormat');
    return { status: 'no-write', sourceId, entries: [], expCats: existing.expCats, incCats: existing.incCats, skipped, reason: 'unknownFormat' };
  }

  const adapter = matches[0];
  const parsed = adapter.parse(source, sourceId);
  if (parsed.kind !== 'rows') {
    tallyReason(skipped, 'malformed');
    return { status: 'no-write', provider: adapter.provider, sourceId, entries: [], expCats: existing.expCats, incCats: existing.incCats, skipped, reason: 'invalidProviderOutput' };
  }
  for (const [reason, count] of Object.entries(parsed.tally ?? {})) {
    if (reason in skipped && typeof count === 'number') skipped[reason as ImportSkipReason] += count;
  }

  const seen = new Set(existing.entries.flatMap((entry) => entry.importProvenance ? [rowKey({ ...entry, note: entry.note, provenance: entry.importProvenance })] : []));
  const entries: Transaction[] = [];
  let expCats = [...existing.expCats];
  let incCats = [...existing.incCats];
  for (const row of parsed.rows) {
    const validation = validateFinancialRow(row);
    if (!validation.valid) { tallyReason(skipped, validation.reason as FinancialRowInvalidReason); continue; }
    if (options.currency && row.currencyCode && row.currencyCode !== options.currency.code) { tallyReason(skipped, 'currencyMismatch'); continue; }
    if (row.unsupportedFields?.length) { tallyReason(skipped, 'unsupportedField'); continue; }
    const key = rowKey(row);
    if (seen.has(key)) { tallyReason(skipped, 'duplicate'); continue; }
    seen.add(key);
    const entry: Transaction = {
      id: stableId(), timestamp: new Date().toISOString(), y: validation.row.y,
      m: validation.row.m, day: validation.row.day, type: validation.row.type,
      amount: validation.row.amount, category: validation.row.category, note: row.note,
      repeat: 'never', importProvenance: row.provenance,
    };
    if (entry.type === 'expense') expCats = addCategory(expCats, entry.category);
    else incCats = addCategory(incCats, entry.category);
    entries.push(entry);
  }
  return { status: 'ready', provider: adapter.provider, sourceId, entries, expCats, incCats, skipped };
}

/** Byte entry point: decoding stays owned by the selected provider adapter. */
export function previewImportBytes(
  bytes: Uint8Array,
  existing: ImportState,
  adapters: ImportAdapter[],
  options: { currency?: Currency; sourceId?: string } = {},
): ImportPreview {
  const decoded = adapters
    .map((adapter) => ({ adapter, source: adapter.decode(bytes) }))
    .filter((item): item is { adapter: ImportAdapter; source: string } => item.source !== null);
  if (decoded.length !== 1) {
    const tally = { ...EMPTY_TALLY };
    tally[decoded.length === 0 ? 'unknownFormat' : 'ambiguousFormat'] = 1;
    return { status: 'no-write', sourceId: options.sourceId ?? 'unknown', entries: [], expCats: existing.expCats, incCats: existing.incCats, skipped: tally, reason: decoded.length === 0 ? 'unknownFormat' : 'ambiguousFormat' };
  }
  return previewImport(decoded[0].source, existing, [decoded[0].adapter], options);
}

/** Apply a ready preview as one state value. No-write previews return the input unchanged. */
export function applyImportPreview(existing: ImportState, preview: ImportPreview): ImportState {
  if (preview.status !== 'ready') return existing;
  return { entries: [...existing.entries, ...preview.entries], expCats: preview.expCats, incCats: preview.incCats };
}

export const applyImport = applyImportPreview;
