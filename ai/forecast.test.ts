/**
 * Month-end forecast (PRD #145): actual-to-date + projected repeats still to
 * come + trailing everyday pace × remaining days. Current month only; hidden
 * before day 5 or with fewer than 5 entries.
 */
import type { RecurrenceRule, Transaction } from '../domain';
import { DEFAULT_STATE, type AppState } from '../store/schema';
import type { Fact } from './contract';
import { buildForecastFacts } from './forecast';

let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? `t${n++}`,
  timestamp: '2026-10-01T03:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 100,
  category: 'Food',
  note: '',
  repeat: 'never',
  ...over,
});

const rule = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  id: over.id ?? `r${n++}`,
  timestamp: '2026-01-01T03:00:00.000Z',
  start: { y: 2026, m: 0, day: 25 },
  anchorDay: over.start?.day ?? 25,
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
const byId = (facts: Fact[] | null) => Object.fromEntries((facts ?? []).map((f) => [f.id, f]));

/** Five ¥1,000 everyday entries on days 1–5 of October 2026. */
const fiveDays = () => [1, 2, 3, 4, 5].map((day) => tx({ day, amount: 1000 }));

describe('buildForecastFacts', () => {
  it('is hidden before day 5', () => {
    const s = state({ entries: [1, 2, 3, 4, 4, 4].map((day) => tx({ day })) });
    expect(buildForecastFacts(s, { y: 2026, m: 9, day: 4 }, 'ja')).toBeNull();
  });

  it('is hidden with fewer than 5 entries this month', () => {
    const s = state({ entries: [1, 2, 3, 4].map((day) => tx({ day })) });
    expect(buildForecastFacts(s, { y: 2026, m: 9, day: 10 }, 'ja')).toBeNull();
  });

  it('does not count entries dated after today toward the minimum', () => {
    const s = state({ entries: [1, 2, 3, 4, 20].map((day) => tx({ day })) });
    expect(buildForecastFacts(s, { y: 2026, m: 9, day: 10 }, 'ja')).toBeNull();
  });

  it('shows from day 5 with 5 entries: actual + pace × remaining days', () => {
    // Oct has 31 days: ¥5,000 so far, pace ¥1,000/day, 26 days left → ¥31,000.
    const f = byId(buildForecastFacts(state({ entries: fiveDays() }), { y: 2026, m: 9, day: 5 }, 'ja'));
    expect(f['forecast-month-end']).toMatchObject({ value: 31000, display: '¥31,000' });
    expect(f['forecast-spent']).toMatchObject({ value: 5000, display: '¥5,000' });
    expect(f['forecast-daily-pace']).toMatchObject({ value: 1000, display: '¥1,000' });
  });

  it('cites the month-end figure first (the line the models word)', () => {
    const facts = buildForecastFacts(state({ entries: fiveDays() }), { y: 2026, m: 9, day: 5 }, 'en');
    expect(facts?.[0].id).toBe('forecast-month-end');
  });

  it('uses 30 days for a 30-day month', () => {
    // Nov 2026 has 30 days: ¥5,000 + ¥1,000 × 25 = ¥30,000.
    const entries = fiveDays().map((t) => ({ ...t, m: 10 }));
    const f = byId(buildForecastFacts(state({ entries }), { y: 2026, m: 10, day: 5 }, 'ja'));
    expect(f['forecast-month-end'].value).toBe(30000);
  });

  it('on the last day the forecast is just the actual total', () => {
    const f = byId(buildForecastFacts(state({ entries: fiveDays() }), { y: 2026, m: 9, day: 31 }, 'ja'));
    expect(f['forecast-month-end'].value).toBe(5000);
  });

  it('adds repeats still to come, and keeps them out of the daily pace', () => {
    // Rent ¥80,000 on the 25th (still to come on the 10th) + rent paid on the 3rd.
    const s = state({
      entries: fiveDays(),
      recurrenceRules: [rule({}), rule({ amount: 3000, note: 'Gym', start: { y: 2026, m: 0, day: 3 } })],
    });
    const f = byId(buildForecastFacts(s, { y: 2026, m: 9, day: 10 }, 'ja'));
    // actual = 5,000 + 3,000 (gym on the 3rd); pace = 5,000 / 10 = 500; 21 days left.
    expect(f['forecast-spent'].value).toBe(8000);
    expect(f['forecast-daily-pace'].value).toBe(500);
    expect(f['forecast-scheduled'].value).toBe(80000);
    expect(f['forecast-month-end'].value).toBe(8000 + 80000 + 500 * 21);
  });

  it('ignores income', () => {
    const s = state({ entries: [...fiveDays(), tx({ day: 2, type: 'income', amount: 250000, category: 'Salary' })] });
    const f = byId(buildForecastFacts(s, { y: 2026, m: 9, day: 5 }, 'ja'));
    expect(f['forecast-month-end'].value).toBe(31000);
  });

  it('only looks at the current month', () => {
    // September entries do not leak into October's pace.
    const s = state({ entries: [...fiveDays(), tx({ m: 8, day: 30, amount: 99999 })] });
    const f = byId(buildForecastFacts(s, { y: 2026, m: 9, day: 5 }, 'ja'));
    expect(f['forecast-spent'].value).toBe(5000);
  });

  it('compares with the budget when one is set', () => {
    const over = state({ entries: fiveDays(), budgetMode: 'total', totalBudget: 20000 });
    const f = byId(buildForecastFacts(over, { y: 2026, m: 9, day: 5 }, 'ja'));
    expect(f['forecast-month-end'].tone).toBe('watch');
    expect(f['forecast-budget-gap']).toMatchObject({ value: -11000, display: '−¥11,000' });

    const under = state({ entries: fiveDays(), budgetMode: 'total', totalBudget: 50000 });
    const g = byId(buildForecastFacts(under, { y: 2026, m: 9, day: 5 }, 'ja'));
    expect(g['forecast-month-end'].tone).toBe('positive');
    expect(g['forecast-budget-gap']).toMatchObject({ value: 19000, display: '¥19,000' });
  });

  it('has no budget fact without a budget', () => {
    const f = byId(buildForecastFacts(state({ entries: fiveDays() }), { y: 2026, m: 9, day: 5 }, 'ja'));
    expect(f['forecast-budget-gap']).toBeUndefined();
    expect(f['forecast-month-end'].tone).toBe('neutral');
  });
});
