import {
  applyImportPreview,
  previewImport,
  previewImportBytes,
  zaimImportAdapter,
  type ImportState,
} from './index';
import { DEFAULT_STATE, normalizePersistedState } from '../store/schema';

const HEADER = '日付,方法,カテゴリ,カテゴリの内訳,支払元,入金先,品目,メモ,お店,通貨,収入,支出,振替,残高調整';
const state = (): ImportState => ({ entries: [], expCats: ['Food'], incCats: ['Salary'] });

describe('provider-neutral import pipeline', () => {
  it('preserves identical purchases as separate rows using source provenance', () => {
    const csv = [
      HEADER,
      '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-',
      '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-',
    ].join('\n');
    const first = previewImport(csv, state(), [zaimImportAdapter], { currency: { code: 'JPY', symbol: '¥' } });
    expect(first.entries).toHaveLength(2);
    expect(first.entries[0].importProvenance?.row).toBe(0);
    expect(first.entries[1].importProvenance?.row).toBe(1);

    const committed = applyImportPreview(state(), first);
    const second = previewImport(csv, committed, [zaimImportAdapter], { currency: { code: 'JPY', symbol: '¥' } });
    expect(second.entries).toHaveLength(0);
    expect(second.skipped.duplicate).toBe(2);
  });

  it('returns an explicit no-write preview for unknown formats', () => {
    const preview = previewImport('name,amount\nlunch,900', state(), [zaimImportAdapter]);
    expect(preview.status).toBe('no-write');
    expect(preview.reason).toBe('unknownFormat');
    expect(applyImportPreview(state(), preview)).toEqual(state());
  });

  it('keeps byte decoding inside the provider adapter contract', () => {
    const csv = [HEADER, '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-'].join('\n');
    const preview = previewImportBytes(new Uint8Array(Buffer.from(csv, 'utf8')), state(), [zaimImportAdapter]);
    expect(preview.entries).toHaveLength(1);
  });

  it('keeps provenance through the persisted transaction boundary', () => {
    const csv = [HEADER, '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-'].join('\n');
    const preview = previewImport(csv, state(), [zaimImportAdapter]);
    const restored = normalizePersistedState({ ...DEFAULT_STATE, entries: preview.entries });
    expect(restored?.entries[0].importProvenance).toEqual(preview.entries[0].importProvenance);
  });

  it('tallies currency mismatches without applying any mismatched row', () => {
    const csv = [HEADER, '2026-07-01,Cash,Food,-,-,-,-,-,-,USD,-,900,-,-'].join('\n');
    const preview = previewImport(csv, state(), [zaimImportAdapter], { currency: { code: 'JPY', symbol: '¥' } });
    expect(preview.entries).toHaveLength(0);
    expect(preview.skipped.currencyMismatch).toBe(1);
    expect(applyImportPreview(state(), preview).entries).toHaveLength(0);
  });

  it('does not mutate the input state while previewing or applying', () => {
    const existing = state();
    const csv = [HEADER, '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-'].join('\n');
    const preview = previewImport(csv, existing, [zaimImportAdapter]);
    applyImportPreview(existing, preview);
    expect(existing).toEqual(state());
  });

  it('uses exact legacy-row duplicate protection only when requested by the integration', () => {
    const csv = [HEADER, '2026-07-01,Cash,Food,-,-,-,-,Lunch,-,JPY,-,900,-,-'].join('\n');
    const legacy = {
      id: 'legacy-entry', timestamp: '2026-07-01T00:00:00.000Z',
      y: 2026, m: 6, day: 1, type: 'expense' as const, amount: 900,
      category: 'Food', note: 'Lunch', repeat: 'never' as const,
    };
    const existing = { ...state(), entries: [legacy] };

    const provenanceOnly = previewImport(csv, existing, [zaimImportAdapter]);
    expect(provenanceOnly.entries).toHaveLength(1);

    const legacySafe = previewImport(csv, existing, [zaimImportAdapter], { matchLegacyRows: true });
    expect(legacySafe.entries).toHaveLength(0);
    expect(legacySafe.skipped.duplicate).toBe(1);

    const importedExisting = { ...existing, entries: [{ ...legacy, importProvenance: { provider: 'zaim', sourceId: 'other', row: 0 } }] };
    expect(previewImport(csv, importedExisting, [zaimImportAdapter], { matchLegacyRows: true }).entries).toHaveLength(1);
  });
});
