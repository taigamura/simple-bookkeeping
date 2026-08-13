import { readFileSync } from 'node:fs';
import * as Encoding from 'encoding-japanese';

import { applyImportPreview, previewImport, previewImportBytes } from './importPipeline';
import { decodeMoneyforwardMeBytes, moneyforwardMeImportAdapter } from './moneyforward';
import type { ImportState } from './importPipeline';

const fixture = readFileSync('fixtures/moneyforward-me/web-monthly.synthetic.csv', 'utf8');
const state = (): ImportState => ({ entries: [], expCats: ['Food'], incCats: ['Salary'] });

describe('MoneyForward ME web-monthly adapter', () => {
  it('imports only verified ordinary rows with source category, date, type, amount, and provenance', () => {
    const preview = previewImport(fixture, state(), [moneyforwardMeImportAdapter], { currency: { code: 'JPY', symbol: '¥' } });

    expect(preview).toMatchObject({ status: 'ready', provider: 'moneyforward-me' });
    expect(preview.entries).toMatchObject([
      { y: 2026, m: 6, day: 1, type: 'expense', amount: 1200, category: '食料品', note: 'SYNTHETIC grocery / SYNTHETIC expense', importProvenance: { provider: 'moneyforward-me', row: 0 } },
      { y: 2026, m: 6, day: 2, type: 'income', amount: 250000, category: '給与', importProvenance: { provider: 'moneyforward-me', row: 1 } },
    ]);
    expect(preview.skipped).toMatchObject({ transfer: 1, unsupportedType: 1, unsupportedField: 1, invalidDate: 1 });
  });

  it('keeps repeated identical purchases while exact re-import remains idempotent', () => {
    const header = '"計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","メモ","振替","ID"';
    const row = '"1","2026/07/01","same purchase","-1200","bank","食費","食料品","memo","0","id"';
    const first = previewImport([header, row, row].join('\n'), state(), [moneyforwardMeImportAdapter]);
    expect(first.entries).toHaveLength(2);
    expect(first.entries.map((entry) => entry.importProvenance?.row)).toEqual([0, 1]);

    const second = previewImport([header, row, row].join('\n'), applyImportPreview(state(), first), [moneyforwardMeImportAdapter]);
    expect(second.entries).toHaveLength(0);
    expect(second.skipped.duplicate).toBe(2);
  });

  it('accepts CP932 and BOM header variants, while failing closed for wrong headers and byte sequences', () => {
    const cp932 = Encoding.convert(fixture, { to: 'SJIS', from: 'UNICODE', type: 'array' });
    expect(decodeMoneyforwardMeBytes(new Uint8Array(cp932))).toContain('"計算対象"');
    expect(previewImportBytes(new Uint8Array(cp932), state(), [moneyforwardMeImportAdapter]).entries).toHaveLength(2);

    const withBom = `\uFEFF${fixture}`;
    expect(decodeMoneyforwardMeBytes(new Uint8Array(Buffer.from(withBom, 'utf8')))).toBe(fixture);
    expect(previewImport('計算対象,日付,内容,金額（円）\n1,2026/07/01,test,-1', state(), [moneyforwardMeImportAdapter])).toMatchObject({ status: 'no-write', reason: 'unknownFormat' });
    expect(decodeMoneyforwardMeBytes(new Uint8Array([0xff, 0xfe, 0xfd]))).toBeNull();
  });

  it('tallies malformed values and provider mismatches without writing entries', () => {
    const header = '"計算対象","日付","内容","金額（円）","保有金融機関","大項目","中項目","メモ","振替","ID"';
    const rows = [
      '"1","2026/07/01","bad amount","100.5","bank","食費","食料品","","0","id-1"',
      '"1","2026/07/01","zero","0","bank","食費","食料品","","0","id-2"',
      '"1","2026/07/01","transfer","-100","bank","食費","食料品","","yes","id-3"',
      '"0","2026/07/01","excluded","-100","bank","食費","食料品","","0","id-4"',
      '"1","2026/07/01","partial row"',
    ];
    const preview = previewImport([header, ...rows].join('\n'), state(), [moneyforwardMeImportAdapter]);
    expect(preview.entries).toHaveLength(0);
    expect(preview.skipped).toMatchObject({ invalidAmount: 2, transfer: 1, unsupportedField: 1, malformed: 1 });
  });

  it('reports a configured non-JPY ledger as a currency mismatch', () => {
    const preview = previewImport(fixture, state(), [moneyforwardMeImportAdapter], { currency: { code: 'USD', symbol: '$' } });
    expect(preview.entries).toHaveLength(0);
    expect(preview.skipped.currencyMismatch).toBe(2);
  });
});
