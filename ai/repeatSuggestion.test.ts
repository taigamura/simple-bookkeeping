/**
 * Repeat suggestion (PRD #145): a non-repeat expense logged by hand every
 * month (same note + category, amount ±5%, gaps 28–34 days, ≥3 times) that no
 * repeat rule covers yet and the user hasn't dismissed.
 */
import type { RecurrenceRule, Transaction } from '../domain';
import { DEFAULT_STATE, type AppState } from '../store/schema';
import { suggestRepeat } from './repeatSuggestion';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? `t${n++}`,
  timestamp: '2026-10-01T03:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 1490,
  category: 'Fun',
  note: 'Netflix',
  repeat: 'never',
  ...over,
});

const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  id: over.id ?? `r${n++}`,
  timestamp: '2026-01-01T03:00:00.000Z',
  start: { y: 2026, m: 0, day: 1 },
  anchorDay: 1,
  type: 'expense',
  amount: 1490,
  category: 'Fun',
  note: 'Netflix',
  repeat: 'monthly',
  weekendShift: 'off',
  exceptions: [],
  ...over,
});

const state = (over: Partial<AppState>): AppState => ({ ...DEFAULT_STATE, ...over });
const TODAY = { y: 2026, m: 9, day: 20 };

/** Netflix on Aug 1, Sep 1, Oct 1. */
const monthly = (over: Partial<Transaction> = {}) => [
  tx({ m: 7, day: 1, ...over }),
  tx({ m: 8, day: 1, ...over }),
  tx({ m: 9, day: 1, ...over }),
];

describe('suggestRepeat', () => {
  it('finds a monthly payment logged three times by hand', () => {
    const entries = monthly();
    const s = suggestRepeat(state({ entries }), TODAY, [], 'en');
    expect(s).not.toBeNull();
    expect(s!.entry.id).toBe(entries[2].id); // the latest one
    expect(s!.facts[0]).toMatchObject({ id: 'repeat-name', display: 'Netflix' });
    expect(s!.facts.find((f) => f.id === 'repeat-amount')).toMatchObject({ display: '¥1,490' });
    expect(s!.facts.find((f) => f.id === 'repeat-count')).toMatchObject({ value: 3, display: '3 entries' });
  });

  it('needs at least three occurrences', () => {
    expect(suggestRepeat(state({ entries: monthly().slice(1) }), TODAY, [], 'ja')).toBeNull();
  });

  it('matches notes loosely (case, spaces, full-width) and amounts within ±5%', () => {
    const entries = [
      tx({ m: 7, day: 1, note: 'netflix ', amount: 1490 }),
      tx({ m: 8, day: 2, note: 'ＮＥＴＦＬＩＸ', amount: 1540 }),
      tx({ m: 9, day: 1, note: 'Netflix', amount: 1450 }),
    ];
    expect(suggestRepeat(state({ entries }), TODAY, [], 'ja')).not.toBeNull();
  });

  it('rejects an amount more than 5% off', () => {
    const entries = [tx({ m: 7, day: 1 }), tx({ m: 8, day: 1, amount: 1700 }), tx({ m: 9, day: 1 })];
    expect(suggestRepeat(state({ entries }), TODAY, [], 'ja')).toBeNull();
  });

  it('requires the same category', () => {
    const entries = [tx({ m: 7, day: 1 }), tx({ m: 8, day: 1, category: 'Bills' }), tx({ m: 9, day: 1 })];
    expect(suggestRepeat(state({ entries }), TODAY, [], 'ja')).toBeNull();
  });

  it('accepts month-end drift (Jan 31 → Feb 28 → Mar 31: gaps 28 and 31)', () => {
    const entries = [
      tx({ y: 2026, m: 0, day: 31 }),
      tx({ y: 2026, m: 1, day: 28 }),
      tx({ y: 2026, m: 2, day: 31 }),
    ];
    expect(suggestRepeat(state({ entries }), { y: 2026, m: 3, day: 10 }, [], 'ja')).not.toBeNull();
  });

  it('crosses the year boundary', () => {
    const entries = [
      tx({ y: 2025, m: 10, day: 15 }),
      tx({ y: 2025, m: 11, day: 15 }),
      tx({ y: 2026, m: 0, day: 15 }),
    ];
    expect(suggestRepeat(state({ entries }), { y: 2026, m: 0, day: 20 }, [], 'ja')).not.toBeNull();
  });

  it('rejects gaps outside 28–34 days', () => {
    const weekly = [tx({ day: 1 }), tx({ day: 8 }), tx({ day: 15 })];
    expect(suggestRepeat(state({ entries: weekly }), TODAY, [], 'ja')).toBeNull();
    const skipped = [tx({ m: 6, day: 1 }), tx({ m: 7, day: 1 }), tx({ m: 9, day: 1 })];
    expect(suggestRepeat(state({ entries: skipped }), TODAY, [], 'ja')).toBeNull();
  });

  it('ignores income, repeats and entries after today', () => {
    expect(suggestRepeat(state({ entries: monthly({ type: 'income' }) }), TODAY, [], 'ja')).toBeNull();
    expect(suggestRepeat(state({ entries: monthly({ repeat: 'monthly' }) }), TODAY, [], 'ja')).toBeNull();
    const future = [tx({ m: 8, day: 25 }), tx({ m: 9, day: 25 }), tx({ m: 10, day: 25 })];
    expect(suggestRepeat(state({ entries: future }), TODAY, [], 'ja')).toBeNull();
  });

  it('skips a payment an active repeat rule already covers', () => {
    expect(suggestRepeat(state({ entries: monthly(), recurrenceRules: [rule({})] }), TODAY, [], 'ja')).toBeNull();
    // A rule for something else does not cover it.
    const other = rule({ note: 'Spotify', amount: 980 });
    expect(suggestRepeat(state({ entries: monthly(), recurrenceRules: [other] }), TODAY, [], 'ja')).not.toBeNull();
    // An ended rule no longer covers it.
    const ended = rule({ endsBefore: '2026-06-01' });
    expect(suggestRepeat(state({ entries: monthly(), recurrenceRules: [ended] }), TODAY, [], 'ja')).not.toBeNull();
  });

  it('never returns a dismissed suggestion, and its key is stable as months are added', () => {
    const s = suggestRepeat(state({ entries: monthly() }), TODAY, [], 'ja')!;
    expect(suggestRepeat(state({ entries: monthly() }), TODAY, [s.key], 'ja')).toBeNull();
    const longer = [tx({ m: 7, day: 1 }), tx({ m: 8, day: 1 }), tx({ m: 9, day: 1 }), tx({ m: 10, day: 1 })];
    const later = suggestRepeat(state({ entries: longer }), { y: 2026, m: 10, day: 5 }, [], 'ja')!;
    expect(later.key).toBe(s.key);
    expect(suggestRepeat(state({ entries: longer }), { y: 2026, m: 10, day: 5 }, [s.key], 'ja')).toBeNull();
  });

  it('returns only the most recent of several candidates', () => {
    const gym = [5, 6, 7].map((m) => tx({ m, day: 10, note: 'Gym', category: 'Health', amount: 8000 }));
    const s = suggestRepeat(state({ entries: [...gym, ...monthly()] }), TODAY, [], 'ja')!;
    expect(s.facts[0].display).toBe('Netflix');
    // Gym (last logged Aug 10) is stale by Oct 20; dismissing Netflix leaves nothing recent.
    expect(suggestRepeat(state({ entries: [...gym, ...monthly()] }), TODAY, [s.key], 'ja')).toBeNull();
  });

  it('falls back to the category name when there is no note', () => {
    const s = suggestRepeat(state({ entries: monthly({ note: '' }) }), TODAY, [], 'ja')!;
    expect(s.facts[0].display).toBe('Fun');
  });
});
