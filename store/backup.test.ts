/**
 * Native backup round-trip + validation tests (#: repeat-preserving backup).
 *
 * The whole point of the JSON backup over the Zaim CSV export is fidelity:
 * `recurrenceRules` survive verbatim, so a restore brings repeats back as
 * *rules* rather than the CSV's flattened one-offs. These tests pin that
 * round trip and prove `parseBackup` rejects anything it can't safely restore.
 */
import { parseBackup, serializeBackup } from './backup';
import { DEFAULT_STATE, SCHEMA_VERSION, type AppState } from './schema';
import { saveLedgerItem, type EntryDraft, type Transaction } from '../domain';

const stateWith = (over: Partial<AppState> = {}): AppState => ({
  ...DEFAULT_STATE,
  ...over,
});

const sampleEntry: Transaction = {
  id: 'e1',
  y: 2026,
  m: 6,
  day: 2,
  timestamp: '2026-07-02T03:04:05.000Z',
  type: 'expense',
  amount: 850,
  category: 'Food',
  note: 'Lunch',
  repeat: 'never',
};

// A ledger holding an infinite monthly rule — the data the CSV export can't
// preserve, so the case that matters most for restore.
const withRule = (): AppState => {
  const draft: EntryDraft = {
    type: 'expense',
    amountStr: '1200',
    category: 'Rent',
    note: 'Rent',
    y: 2026,
    m: 6,
    day: 1,
    repeat: 'monthly',
  };
  const ledger = saveLedgerItem({ entries: [], recurrenceRules: [] }, draft, 'after');
  return stateWith({ entries: [sampleEntry], recurrenceRules: ledger.recurrenceRules });
};

describe('serializeBackup / parseBackup', () => {
  it('round-trips the whole ledger, recurrence rules included', () => {
    const state = withRule();

    const restored = parseBackup(serializeBackup(state));

    expect(restored).toEqual(state);
    // The rule survives as a rule, not a flattened occurrence.
    expect(restored?.recurrenceRules).toHaveLength(1);
    expect(restored?.recurrenceRules[0].repeat).toBe('monthly');
  });

  it('round-trips non-ledger state too (budgets, categories, currency, settings)', () => {
    const state = stateWith({
      expCats: ['Food', 'Rent'],
      budgets: { Food: 40000 },
      budgetMode: 'total',
      totalBudget: 200000,
      theme: 'light',
    });

    expect(parseBackup(serializeBackup(state))).toEqual(state);
  });

  it('rejects a file that is not JSON', () => {
    expect(parseBackup('not a backup')).toBeNull();
  });

  it('rejects an envelope from a different schema version', () => {
    const blob = JSON.stringify({ version: SCHEMA_VERSION + 1, state: DEFAULT_STATE });

    expect(parseBackup(blob)).toBeNull();
  });

  it('rejects an envelope whose state fails validation', () => {
    const blob = JSON.stringify({
      version: SCHEMA_VERSION,
      state: { ...DEFAULT_STATE, entries: [{ id: 'x', amount: 'lots' }] },
    });

    expect(parseBackup(blob)).toBeNull();
  });

  it('rejects a bare state object with no envelope', () => {
    expect(parseBackup(JSON.stringify(DEFAULT_STATE))).toBeNull();
  });
});
