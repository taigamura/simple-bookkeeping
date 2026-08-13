import { readFileSync } from 'node:fs';

import { applyImportPreview, previewImport, previewImportBytes } from './importPipeline';
import { decodeOkaneRecoBytes, okaneRecoImportAdapter } from './okaneReco';
import type { ImportState } from './importPipeline';

const fixture = readFileSync('fixtures/okane-reco/transaction-detail.synthetic.csv', 'utf8');
const state = (): ImportState => ({ entries: [], expCats: ['Food'], incCats: ['Salary'] });

describe('おカネレコ transaction-detail adapter', () => {
  it('imports the verified ordinary rows with category, date, type, amount, and provenance intact', () => {
    const preview = previewImport(fixture, state(), [okaneRecoImportAdapter], { currency: { code: 'JPY', symbol: '¥' } });

    expect(preview).toMatchObject({ status: 'ready', provider: 'okane-reco' });
    expect(preview.entries).toHaveLength(5);
    expect(preview.entries.slice(0, 3)).toMatchObject([
      { y: 2026, m: 6, day: 1, type: 'expense', amount: 1200, category: '食費', note: 'SYNTHETIC grocery', importProvenance: { provider: 'okane-reco', row: 0 } },
      { y: 2026, m: 6, day: 2, type: 'income', amount: 250000, category: '収入', importProvenance: { provider: 'okane-reco', row: 1 } },
      { y: 2026, m: 6, day: 3, type: 'expense', amount: 680, category: '交通費', importProvenance: { provider: 'okane-reco', row: 2 } },
    ]);
    // The contract prohibits inferring a refund or transfer from a memo alone.
    expect(preview.skipped).toMatchObject({ invalidDate: 1, emptyCategory: 1 });
  });

  it('keeps repeated identical purchases, but makes an exact re-import idempotent by source row', () => {
    const csv = [
      'DATE,TIME,CATEGORY,CURRENCY,PRICE,MEMO,PAYMENT',
      '2026/07/01,08:15,食費,¥,1200,same purchase,CASH',
      '2026/07/01,08:15,食費,¥,1200,same purchase,CASH',
    ].join('\n');
    const first = previewImport(csv, state(), [okaneRecoImportAdapter]);
    expect(first.entries).toHaveLength(2);
    expect(first.entries.map((entry) => entry.importProvenance?.row)).toEqual([0, 1]);

    const second = previewImport(csv, applyImportPreview(state(), first), [okaneRecoImportAdapter]);
    expect(second.entries).toHaveLength(0);
    expect(second.skipped.duplicate).toBe(2);
  });

  it('rejects unsupported currencies, malformed values, and non-detail headers with explicit tallies', () => {
    const csv = [
      'DATE,TIME,CATEGORY,CURRENCY,PRICE,MEMO,PAYMENT',
      '2026/07/01,08:15,食費,$,1200,wrong currency,CASH',
      '2026/07/01,08:15,食費,¥,-100,negative,CASH',
      '2026/07/01,8:15,食費,¥,100,bad time,CASH',
      '2026/07/01,08:15,食費,¥,100,missing payment,',
    ].join('\n');
    const preview = previewImport(csv, state(), [okaneRecoImportAdapter], { currency: { code: 'JPY', symbol: '¥' } });
    expect(preview.entries).toHaveLength(0);
    expect(preview.skipped).toMatchObject({ currencyMismatch: 1, invalidAmount: 1, malformed: 2 });

    const wrongHeader = previewImport('DATE,CATEGORY,PRICE\n2026/07/01,食費,100', state(), [okaneRecoImportAdapter]);
    expect(wrongHeader).toMatchObject({ status: 'no-write', reason: 'unknownFormat' });
  });

  it('decodes UTF-8 (including BOM) but fails closed for malformed UTF-8 bytes', () => {
    const withBom = `\uFEFF${fixture}`;
    expect(decodeOkaneRecoBytes(new Uint8Array(Buffer.from(withBom, 'utf8')))).toBe(fixture);
    expect(previewImportBytes(new Uint8Array(Buffer.from(withBom, 'utf8')), state(), [okaneRecoImportAdapter]).entries).toHaveLength(5);
    expect(decodeOkaneRecoBytes(new Uint8Array([0xff, 0xfe, 0xfd]))).toBeNull();
  });
});
