/**
 * Day fact sheet (PRD #145, Calendar day note). Pure; what is notable about one
 * selected day, for the model to word in one line (ADR-0006).
 *
 * Comparisons use everyday spending only (concrete, non-repeat expenses), so
 * rent day doesn't read as a splurge. A day is notable when:
 *   - its everyday spend is ≥ 2× the median of the previous 8 same weekdays
 *     (at least 3 of them inside the user's history, median > 0), or
 *   - ≥ 2× the month's daily average over the other elapsed days, or
 *   - it has an expense category never used before.
 * Nothing notable, a future day, a day with no spending, or a ledger with
 * fewer than 10 earlier entries (a brand new user) → [] and no note shows.
 *
 * Fact ids: day-total (first; the day's whole spending, repeats included),
 * day-vs-weekday, day-vs-average, day-new-category, day-top-category.
 */
import {
  MINUS,
  MONTH_NAMES,
  WEEKDAY_ABBR,
  entriesForMonth,
  yen,
  type Transaction,
  type YM,
} from '../domain';
import type { AppState } from '../store/schema';
import type { Fact, Locale, YMD } from './contract';
import { elapsedDays } from './snapshot';

const LOOKBACK_WEEKS = 8;
const MIN_SAMPLES = 3;
const MIN_HISTORY = 10;
const FACTOR = 2;
const DAY_MS = 86_400_000;

const isRepeat = (t: Transaction) => t.occurrence != null || (t.repeat ?? 'never') !== 'never';
const dayNumber = (d: { y: number; m: number; day: number }) => Date.UTC(d.y, d.m, d.day) / DAY_MS;
const pct = (cur: number, base: number) => Math.round(((cur - base) / base) * 100);
const fmtPct = (v: number) => (v > 0 ? `+${v}%` : v < 0 ? `${MINUS}${Math.abs(v)}%` : '0%');

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function buildDayFacts(state: AppState, date: YMD, today: YMD, _locale: Locale): Fact[] {
  const target = dayNumber(date);
  if (target > dayNumber(today)) return [];

  const everyday = state.entries.filter((t) => t.type === 'expense' && !isRepeat(t));
  const earlier = state.entries.filter((t) => dayNumber(t) < target);
  if (earlier.length < MIN_HISTORY) return [];

  const month = entriesForMonth(state, { y: date.y, m: date.m });
  const dayAll = month.filter((t) => t.day === date.day && t.type === 'expense');
  const total = dayAll.reduce((s, t) => s + t.amount, 0);
  const daySpend = dayAll.filter((t) => !isRepeat(t)).reduce((s, t) => s + t.amount, 0);
  if (total === 0) return [];

  const money = (v: number) => yen(v, state.currency.symbol);
  const when = `${WEEKDAY_ABBR[new Date(date.y, date.m, date.day).getDay()]} ${MONTH_NAMES[date.m]} ${date.day}`;
  const triggers: Fact[] = [];

  // Same weekday, previous 8 weeks, inside the user's history.
  const byDay = new Map<number, number>();
  for (const t of everyday) byDay.set(dayNumber(t), (byDay.get(dayNumber(t)) ?? 0) + t.amount);
  const firstDay = state.entries.reduce((min, t) => Math.min(min, dayNumber(t)), Infinity);
  const samples: number[] = [];
  for (let w = 1; w <= LOOKBACK_WEEKS; w++) {
    const d = target - 7 * w;
    if (d >= firstDay) samples.push(byDay.get(d) ?? 0);
  }
  if (samples.length >= MIN_SAMPLES && daySpend > 0) {
    const med = median(samples);
    if (med > 0 && daySpend >= FACTOR * med) {
      const v = pct(daySpend, med);
      triggers.push({
        id: 'day-vs-weekday',
        label: `Everyday spending on ${when} vs a typical ${WEEKDAY_ABBR[new Date(date.y, date.m, date.day).getDay()]} (median of recent weeks): ${fmtPct(v)} (${money(daySpend)} vs ${money(med)})`,
        display: fmtPct(v),
        value: v,
        tone: 'watch',
      });
    }
  }

  // The month's daily average over the other elapsed days.
  const ym: YM = { y: date.y, m: date.m };
  const elapsed = elapsedDays(ym, today);
  const otherDays = elapsed - 1;
  if (otherDays > 0 && daySpend > 0) {
    const others = month
      .filter((t) => t.type === 'expense' && !isRepeat(t) && t.day <= elapsed && t.day !== date.day)
      .reduce((s, t) => s + t.amount, 0);
    const avg = others / otherDays;
    if (avg > 0 && daySpend >= FACTOR * avg) {
      const v = pct(daySpend, avg);
      triggers.push({
        id: 'day-vs-average',
        label: `Everyday spending on ${when} vs the ${MONTH_NAMES[date.m]} daily average: ${fmtPct(v)} (${money(daySpend)} vs ${money(avg)})`,
        display: fmtPct(v),
        value: v,
        tone: 'watch',
      });
    }
  }

  // A category used for the first time.
  const seen = new Set(everyday.filter((t) => dayNumber(t) < target).map((t) => t.category));
  const fresh = dayAll.find((t) => !isRepeat(t) && !seen.has(t.category));
  if (fresh) {
    triggers.push({
      id: 'day-new-category',
      label: `First ever spending in the category "${fresh.category}" was on ${when}`,
      display: fresh.category,
      value: fresh.amount,
      tone: 'neutral',
    });
  }

  if (triggers.length === 0) return [];

  const byCat = new Map<string, number>();
  for (const t of dayAll) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  const [topCat, topAmt] = [...byCat].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  return [
    {
      id: 'day-total',
      label: `Total spending on ${when} (repeats included): ${money(total)}`,
      display: money(total),
      value: total,
      tone: 'neutral',
    },
    ...triggers,
    {
      id: 'day-top-category',
      label: `Biggest category on ${when}: ${topCat} (${money(topAmt)})`,
      display: topCat,
      value: topAmt,
      tone: 'neutral',
    },
  ];
}

/** Stable short hash of a day's entries (the day-note cache key changes when they do). */
export function dayEntriesHash(entries: Transaction[]): string {
  const src = entries
    .map((t) => `${t.id}:${t.type}:${t.amount}:${t.category}`)
    .sort()
    .join('|');
  let h = 5381;
  for (let i = 0; i < src.length; i++) h = ((h * 33) ^ src.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
