/**
 * Day fact sheet (PRD #145): what is notable about one selected day. An
 * ordinary day returns [] so no note shows.
 */
import type { RecurrenceRule, Transaction } from '../domain';
import { DEFAULT_STATE, type AppState } from '../store/schema';
import type { Fact } from './contract';
import { buildDayFacts } from './dayFacts';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? `t${n++}`,
  timestamp: '2026-10-01T03:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 1000,
  category: 'Food',
  note: '',
  repeat: 'never',
  ...over,
});

const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  id: over.id ?? `r${n++}`,
  timestamp: '2026-01-01T03:00:00.000Z',
  start: { y: 2026, m: 0, day: 25 },
  anchorDay: 25,
  type: 'expense',
  amount: 80000,
  category: 'Bills',
  note: 'Rent',
  repeat: 'monthly',
  weekendShift: 'off',
  exceptions: [],
  ...over,
});

const state = (over: Partial<AppState>): AppState => ({ ...DEFAULT_STATE, ...over });
const byId = (facts: Fact[]) => Object.fromEntries(facts.map((f) => [f.id, f]));
const TODAY = { y: 2026, m: 9, day: 20 };

/** ¥1,000 of Food every day from Aug 1 to Oct 20, 2026 (a steady baseline). */
function steady(): Transaction[] {
  const out: Transaction[] = [];
  for (let d = new Date(2026, 7, 1); d <= new Date(2026, 9, 20); d.setDate(d.getDate() + 1)) {
    out.push(tx({ y: d.getFullYear(), m: d.getMonth(), day: d.getDate() }));
  }
  return out;
}

const withDay = (entries: Transaction[], day: number, extra: Partial<Transaction>[]) => [
  ...entries.filter((t) => !(t.y === 2026 && t.m === 9 && t.day === day)),
  ...extra.map((e) => tx({ day, ...e })),
];

describe('buildDayFacts', () => {
  it('returns [] for an ordinary day', () => {
    expect(buildDayFacts(state({ entries: steady() }), { y: 2026, m: 9, day: 14 }, TODAY, 'ja')).toEqual([]);
  });

  it('returns [] for a day with no spending, and for future days', () => {
    const entries = withDay(steady(), 14, []);
    expect(buildDayFacts(state({ entries }), { y: 2026, m: 9, day: 14 }, TODAY, 'ja')).toEqual([]);
    const future = [...steady(), tx({ day: 25, amount: 50000 })];
    expect(buildDayFacts(state({ entries: future }), { y: 2026, m: 9, day: 25 }, TODAY, 'ja')).toEqual([]);
  });

  it('flags a big day vs the same weekday and the month average, day total first', () => {
    const entries = withDay(steady(), 14, [{ amount: 4000 }, { amount: 1000, category: 'Transport' }]);
    const facts = buildDayFacts(state({ entries }), { y: 2026, m: 9, day: 14 }, TODAY, 'en');
    expect(facts[0]).toMatchObject({ id: 'day-total', value: 5000, display: '¥5,000' });
    const f = byId(facts);
    expect(f['day-vs-weekday']).toMatchObject({ value: 400, display: '+400%' });
    expect(f['day-vs-average'].value).toBeGreaterThanOrEqual(100);
    expect(f['day-top-category']).toMatchObject({ display: 'Food' });
  });

  it('keeps repeat occurrences out of the comparison (rent day is not "notable")', () => {
    const s = state({ entries: steady(), recurrenceRules: [rule({ start: { y: 2026, m: 0, day: 13 } })] });
    expect(buildDayFacts(s, { y: 2026, m: 9, day: 13 }, TODAY, 'ja')).toEqual([]);
  });

  it('flags a first-time category once there is history', () => {
    const entries = [...steady(), tx({ day: 14, amount: 1000, category: 'Gifts' })];
    const f = byId(buildDayFacts(state({ entries }), { y: 2026, m: 9, day: 14 }, TODAY, 'ja'));
    expect(f['day-new-category']).toMatchObject({ display: 'Gifts' });
    expect(f['day-total'].display).toBe('¥2,000');
  });

  it('does not call everything first-time for a brand new user', () => {
    const entries = [tx({ day: 1, category: 'Gifts' })];
    expect(buildDayFacts(state({ entries }), { y: 2026, m: 9, day: 1 }, TODAY, 'ja')).toEqual([]);
  });

  it('works on the 31st and across a month boundary (weekday lookback reaches back into September)', () => {
    const entries = [...steady().filter((t) => !(t.m === 9 && t.day > 3)), tx({ day: 3, amount: 6000 })];
    // Oct 3 2026 is a Saturday; the lookback Saturdays are all in Aug/Sep.
    const f = byId(buildDayFacts(state({ entries }), { y: 2026, m: 9, day: 3 }, TODAY, 'ja'));
    expect(f['day-vs-weekday']).toBeDefined();
    const aug31 = withDay(steady(), 0, []).map((t) => (t.m === 7 && t.day === 31 ? { ...t, amount: 9000 } : t));
    const g = byId(buildDayFacts(state({ entries: aug31 }), { y: 2026, m: 7, day: 31 }, TODAY, 'ja'));
    expect(g['day-total'].value).toBe(9000);
  });
});
