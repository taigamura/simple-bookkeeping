/**
 * Month-end forecast (PRD #145, Calendar one-liner). Pure; code computes the
 * number, the model only words it (ADR-0006).
 *
 *   forecast = spent so far (repeats included)
 *            + scheduled spending still to come this month (projected repeat
 *              occurrences, plus any entries the user already dated later)
 *            + everyday pace × remaining days
 *   everyday pace = non-repeat spending so far / elapsed days
 *
 * Current month only. Hidden (null) before day 5 or with fewer than 5 entries
 * dated up to today: too little to project from.
 *
 * Fact ids: forecast-month-end (always first), forecast-spent,
 * forecast-daily-pace, forecast-scheduled (when > 0), forecast-budget-gap
 * (when a budget is set).
 */
import { MINUS, MONTH_NAMES, daysInMonth, entriesForMonth, yen, type Transaction } from '../domain';
import type { AppState } from '../store/schema';
import type { Fact, Locale, YMD } from './contract';
import { budgetAmount } from './snapshot';

export const FORECAST_MIN_DAY = 5;
export const FORECAST_MIN_ENTRIES = 5;

const isRepeat = (t: Transaction) => t.occurrence != null || (t.repeat ?? 'never') !== 'never';
const spend = (list: Transaction[]) =>
  list.reduce((sum, t) => (t.type === 'expense' ? sum + t.amount : sum), 0);

export function buildForecastFacts(state: AppState, today: YMD, _locale: Locale): Fact[] | null {
  if (today.day < FORECAST_MIN_DAY) return null;
  const month = entriesForMonth(state, { y: today.y, m: today.m });
  const sofar = month.filter((t) => t.day <= today.day);
  if (sofar.length < FORECAST_MIN_ENTRIES) return null;

  const money = (v: number) => yen(v, state.currency.symbol);
  const monthName = `${MONTH_NAMES[today.m]} ${today.y}`;
  const remaining = daysInMonth(today.y, today.m) - today.day;

  const spent = spend(sofar);
  const scheduled = spend(month.filter((t) => t.day > today.day));
  const pace = Math.round(spend(sofar.filter((t) => !isRepeat(t))) / today.day);
  const forecast = Math.round(spent + scheduled + pace * remaining);

  const budget = budgetAmount(state);
  const facts: Fact[] = [
    {
      id: 'forecast-month-end',
      label: `Projected total spending by the end of ${monthName} at the current pace: ${money(forecast)}`,
      display: money(forecast),
      value: forecast,
      tone: budget === null ? 'neutral' : forecast > budget ? 'watch' : 'positive',
    },
    {
      id: 'forecast-spent',
      label: `Spending in ${monthName} so far (repeats included): ${money(spent)}`,
      display: money(spent),
      value: spent,
      tone: 'neutral',
    },
    {
      id: 'forecast-daily-pace',
      label: `Average everyday spending per day so far (repeating payments excluded): ${money(pace)}`,
      display: money(pace),
      value: pace,
      tone: 'neutral',
    },
  ];
  if (scheduled > 0) {
    facts.push({
      id: 'forecast-scheduled',
      label: `Repeating or scheduled payments still to come in ${monthName}: ${money(scheduled)}`,
      display: money(scheduled),
      value: scheduled,
      tone: 'neutral',
    });
  }
  if (budget !== null) {
    const gap = budget - forecast;
    facts.push({
      id: 'forecast-budget-gap',
      label:
        gap >= 0
          ? `Projected budget left at the end of ${monthName}: ${money(gap)}`
          : `Projected amount over the ${monthName} budget at the end of the month: ${money(-gap)}`,
      display: gap >= 0 ? money(gap) : `${MINUS}${money(-gap)}`,
      value: gap,
      tone: gap >= 0 ? 'positive' : 'watch',
    });
  }
  return facts;
}
