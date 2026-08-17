/**
 * The screenshot sample ledger (#79) must stay a coherent, self-consistent demo:
 * every entry's category exists in the matching list, budgets key only real
 * expense categories, and the data lands in the advertised month.
 */
import { expense, income } from './entries';
import { SAMPLE_MONTH, SAMPLE_SELECTED_DAY, sampleLedger } from './sampleData';

describe('sampleLedger', () => {
  const s = sampleLedger();

  it('lands entirely in the sample month (June 2026)', () => {
    expect(SAMPLE_MONTH).toEqual({ y: 2026, m: 5 });
    expect(s.entries.every((e) => e.y === 2026 && e.m === 5)).toBe(true);
  });

  it('has deterministic ids and timestamps (reproducible captures)', () => {
    expect(sampleLedger()).toEqual(s);
    expect(s.entries.map((e) => e.id)).toEqual([
      'sample-1',
      'sample-2',
      'sample-3',
      'sample-4',
      'sample-5',
      'sample-6',
      'sample-7',
    ]);
  });

  it('selects a day that actually carries an entry', () => {
    expect(s.entries.some((e) => e.day === SAMPLE_SELECTED_DAY)).toBe(true);
  });

  it('references only categories that exist in the corresponding list', () => {
    for (const e of s.entries) {
      const list = e.type === 'income' ? s.incCats : s.expCats;
      expect(list).toContain(e.category);
    }
  });

  it('budgets only real expense categories', () => {
    for (const cat of Object.keys(s.budgets)) {
      expect(s.expCats).toContain(cat);
    }
  });

  it('shows both income and expense activity (a full month for the summary shot)', () => {
    expect(income(s.entries)).toBeGreaterThan(0);
    expect(expense(s.entries)).toBeGreaterThan(0);
  });
});
