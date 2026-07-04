/**
 * Zaim import tests (slice #12): `parseZaimCsv` against a small synthetic
 * fixture (never a real export — see `.ralph/fix_plan.md`), and
 * `decodeZaimBytes` against a Shift-JIS-encoded sample built at test time.
 */
import * as Encoding from 'encoding-japanese';

import { decodeZaimBytes, parseZaimCsv, type ZaimExisting } from './zaim';

const HEADER =
  '日付,方法,カテゴリ,カテゴリの内訳,支払元,入金先,品目,メモ,お店,通貨,収入,支出,振替,残高調整';

const cats = (over: Partial<ZaimExisting> = {}): ZaimExisting => ({
  expCats: ['Food', 'Transport'],
  incCats: ['Salary'],
  entries: [],
  ...over,
});

describe('parseZaimCsv', () => {
  it('turns a payment row into an expense entry', () => {
    const csv = [
      HEADER,
      '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,1200,-,-',
    ].join('\n');
    const { entries } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      y: 2026,
      m: 6,
      day: 1,
      type: 'expense',
      amount: 1200,
      category: 'Food',
    });
  });

  it('turns an income row into an income entry', () => {
    const csv = [
      HEADER,
      '2026-07-02,Bank,Salary,-,-,-,-,-,-,JPY,300000,-,-,-',
    ].join('\n');
    const { entries } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      y: 2026,
      m: 6,
      day: 2,
      type: 'income',
      amount: 300000,
      category: 'Salary',
    });
  });

  it('reuses an existing category (case-insensitive) instead of appending a duplicate', () => {
    const csv = [
      HEADER,
      '2026-07-03,Cash,food,-,-,-,-,-,-,JPY,-,500,-,-',
    ].join('\n');
    const { expCats } = parseZaimCsv(csv, cats());
    expect(expCats).toEqual(['Food', 'Transport']);
  });

  it('appends a category the ledger does not already have', () => {
    const csv = [
      HEADER,
      '2026-07-04,Cash,Hobby,-,-,-,-,-,-,JPY,-,3000,-,-',
    ].join('\n');
    const { expCats } = parseZaimCsv(csv, cats());
    expect(expCats).toEqual(['Food', 'Transport', 'Hobby']);
  });

  it('composes the note from sub-category / item / memo / shop when all are present', () => {
    const csv = [
      HEADER,
      '2026-07-05,Cash,Food,Lunch,-,-,Sandwich,Quick bite,Cafe A,JPY,-,900,-,-',
    ].join('\n');
    const { entries } = parseZaimCsv(csv, cats());
    expect(entries[0].note).toBe('Lunch / Sandwich / Quick bite / Cafe A');
  });

  it('falls back to the category name when all note-source fields are blank', () => {
    const csv = [
      HEADER,
      '2026-07-06,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-',
    ].join('\n');
    const { entries } = parseZaimCsv(csv, cats());
    expect(entries[0].note).toBe('Food');
  });

  it('does not mutate the existing category arrays', () => {
    const existing = cats();
    const csv = [HEADER, '2026-07-07,Cash,Hobby,-,-,-,-,-,-,JPY,-,100,-,-'].join('\n');
    parseZaimCsv(csv, existing);
    expect(existing.expCats).toEqual(['Food', 'Transport']);
  });

  it('starts with a zeroed skip tally when nothing is skipped', () => {
    const csv = [HEADER, '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,1200,-,-'].join('\n');
    const { skipped } = parseZaimCsv(csv, cats());
    expect(skipped).toEqual({ transfer: 0, balanceAdjustment: 0, malformed: 0, duplicate: 0 });
  });

  it('skips a transfer row and counts it, without producing an entry', () => {
    const csv = [
      HEADER,
      '2026-07-08,Transfer,-,-,Bank,Cash,-,-,-,JPY,-,-,5000,-',
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(0);
    expect(skipped).toEqual({ transfer: 1, balanceAdjustment: 0, malformed: 0, duplicate: 0 });
  });

  it('skips a balance-adjustment row and counts it, without producing an entry', () => {
    const csv = [
      HEADER,
      '2026-07-09,Adjust,-,-,-,-,-,-,-,JPY,-,-,-,1000',
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(0);
    expect(skipped).toEqual({ transfer: 0, balanceAdjustment: 1, malformed: 0, duplicate: 0 });
  });

  it('skips a row with a bad date and counts it as malformed', () => {
    const csv = [
      HEADER,
      '2026-13-40,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-',
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(0);
    expect(skipped).toEqual({ transfer: 0, balanceAdjustment: 0, malformed: 1, duplicate: 0 });
  });

  it('skips a row with a non-numeric amount and counts it as malformed', () => {
    const csv = [
      HEADER,
      '2026-07-10,Cash,Food,-,-,-,-,-,-,JPY,-,abc,-,-',
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(0);
    expect(skipped).toEqual({ transfer: 0, balanceAdjustment: 0, malformed: 1, duplicate: 0 });
  });

  it('skips a row with a missing category and counts it as malformed', () => {
    const csv = [
      HEADER,
      '2026-07-11,Cash,-,-,-,-,-,-,-,JPY,-,900,-,-',
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(0);
    expect(skipped).toEqual({ transfer: 0, balanceAdjustment: 0, malformed: 1, duplicate: 0 });
  });

  it('imports every valid row from a file mixing valid, transfer, balance-adjustment, and malformed rows', () => {
    const csv = [
      HEADER,
      '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,1200,-,-',
      '2026-07-02,Bank,Salary,-,-,-,-,-,-,JPY,300000,-,-,-',
      '2026-07-08,Transfer,-,-,Bank,Cash,-,-,-,JPY,-,-,5000,-',
      '2026-07-09,Adjust,-,-,-,-,-,-,-,JPY,-,-,-,1000',
      '2026-13-40,Cash,Food,-,-,-,-,-,-,JPY,-,900,-,-',
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(2);
    expect(skipped).toEqual({ transfer: 1, balanceAdjustment: 1, malformed: 1, duplicate: 0 });
  });

  it('re-importing the same CSV produces zero new entries, all counted as duplicates', () => {
    const csv = [
      HEADER,
      '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,1200,-,-',
      '2026-07-02,Bank,Salary,-,-,-,-,-,-,JPY,300000,-,-,-',
    ].join('\n');
    const first = parseZaimCsv(csv, cats());
    expect(first.entries).toHaveLength(2);

    const second = parseZaimCsv(csv, cats({ entries: first.entries }));
    expect(second.entries).toHaveLength(0);
    expect(second.skipped).toEqual({ transfer: 0, balanceAdjustment: 0, malformed: 0, duplicate: 2 });
  });

  it('only appends rows that are not already in the ledger, counting the rest as duplicates', () => {
    const existingEntries = parseZaimCsv(
      [HEADER, '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,1200,-,-'].join('\n'),
      cats(),
    ).entries;

    const csv = [
      HEADER,
      '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,1200,-,-', // already imported
      '2026-07-02,Bank,Salary,-,-,-,-,-,-,JPY,300000,-,-,-', // new
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats({ entries: existingEntries }));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ day: 2, type: 'income', amount: 300000 });
    expect(skipped).toEqual({ transfer: 0, balanceAdjustment: 0, malformed: 0, duplicate: 1 });
  });

  it('does not treat two different rows on the same day as duplicates of each other', () => {
    const csv = [
      HEADER,
      '2026-07-01,Cash,Food,-,-,-,-,-,-,JPY,-,1200,-,-',
      '2026-07-01,Cash,Food,Snack,-,-,-,-,-,JPY,-,300,-,-',
    ].join('\n');
    const { entries, skipped } = parseZaimCsv(csv, cats());
    expect(entries).toHaveLength(2);
    expect(skipped.duplicate).toBe(0);
  });
});

describe('decodeZaimBytes', () => {
  it('decodes a Shift-JIS-encoded sample and validates the Zaim header', () => {
    const csv = [HEADER, '2026-07-01,現金,食費,-,-,-,-,-,-,JPY,-,1200,-,-'].join('\n');
    const bytes = new Uint8Array(
      Encoding.convert(Encoding.stringToCode(csv), { to: 'SJIS', type: 'array' }),
    );
    expect(decodeZaimBytes(bytes)).toBe(csv);
  });

  it('falls back to UTF-8 when the Shift-JIS decode does not validate the header', () => {
    const csv = [HEADER, '2026-07-01,現金,食費,-,-,-,-,-,-,JPY,-,1200,-,-'].join('\n');
    const bytes = new Uint8Array(Buffer.from(csv, 'utf-8'));
    expect(decodeZaimBytes(bytes)).toBe(csv);
  });

  it('returns null when neither Shift-JIS nor UTF-8 validates the header', () => {
    const notZaim = 'name,amount\nlunch,900';
    const bytes = new Uint8Array(
      Encoding.convert(Encoding.stringToCode(notZaim), { to: 'SJIS', type: 'array' }),
    );
    expect(decodeZaimBytes(bytes)).toBeNull();
  });
});
