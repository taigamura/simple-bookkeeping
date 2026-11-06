/**
 * Fact sheet: the only numbers the models may cite (ADR-0006). Pure over the
 * persisted state; every total reuses the domain maths the Summary and
 * Calendar screens use (repeats count via `entriesForMonth` projection), so a
 * cited number always equals what the user sees on screen.
 *
 * Fact ids (stable; the Swift prompts cite them):
 *   expense-total, income-total, net, expense-vs-last, top-category,
 *   cat-total:<cat> (top 3), cat-pace:<cat> (the one that moved most),
 *   budget-left, budget-pace, no-spend-days, no-spend-streak, biggest-day,
 *   biggest-day-date, entry-count, new-repeat
 *
 * Tone never scolds: 'watch' is the strongest it gets.
 */
import {
  MINUS,
  MONTH_NAMES,
  categoryBreakdown,
  daysInMonth,
  entriesForMonth,
  expense,
  getRemainingBudget,
  income,
  shiftMonth,
  signed,
  yen,
  type Transaction,
  type YM,
} from '../domain';
import type { AppState } from '../store/schema';
import type { Fact, Locale, YMD } from './contract';
import { budgetAmount, elapsedDays, noSpendDays } from './snapshot';

type Tone = Fact['tone'];

const pct = (cur: number, prev: number) => Math.round(((cur - prev) / prev) * 100);
const fmtPct = (v: number) => (v > 0 ? `+${v}%` : v < 0 ? `${MINUS}${Math.abs(v)}%` : '0%');
/** Spending change: down is good news, a big rise is worth a look. */
const changeTone = (v: number): Tone => (v < 0 ? 'positive' : v >= 20 ? 'watch' : 'neutral');
const days = (n: number, locale: Locale) =>
  locale === 'ja' ? `${n}日` : n === 1 ? '1 day' : `${n} days`;
const entriesCount = (n: number, locale: Locale) =>
  locale === 'ja' ? `${n}件` : n === 1 ? '1 entry' : `${n} entries`;
const dateDisplay = (m: number, day: number, locale: Locale) =>
  locale === 'ja' ? `${m + 1}月${day}日` : `${MONTH_NAMES[m].slice(0, 3)} ${day}`;
const upTo = (entries: Transaction[], day: number) => entries.filter((t) => t.day <= day);
const sameYM = (a: YM, b: YM) => a.y === b.y && a.m === b.m;

function expenseByCategory(entries: Transaction[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of entries) {
    if (t.type === 'expense') totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  return totals;
}

/** Days with no expense, counted back from today (crossing month boundaries). */
function noSpendStreak(state: AppState, today: YMD): number {
  const cache = new Map<string, Set<number>>();
  const spendDays = (ym: YM) => {
    const key = `${ym.y}-${ym.m}`;
    let set = cache.get(key);
    if (!set) {
      set = new Set(
        entriesForMonth(state, ym).filter((t) => t.type === 'expense').map((t) => t.day),
      );
      cache.set(key, set);
    }
    return set;
  };
  let streak = 0;
  let ym: YM = { y: today.y, m: today.m };
  let day = today.day;
  while (streak < 400 && !spendDays(ym).has(day)) {
    streak += 1;
    day -= 1;
    if (day < 1) {
      ym = shiftMonth(ym, -1);
      day = daysInMonth(ym.y, ym.m);
    }
  }
  return streak;
}

/** Facts about month (y, m) as of `today` (past months are complete). */
export function buildFacts(state: AppState, y: number, m: number, today: YMD, locale: Locale): Fact[] {
  const ym: YM = { y, m };
  const month = entriesForMonth(state, ym);
  if (month.length === 0) return [];

  const symbol = state.currency.symbol;
  const money = (n: number) => yen(n, symbol);
  const monthName = `${MONTH_NAMES[m]} ${y}`;
  const isCurrent = sameYM(ym, today);
  const elapsed = elapsedDays(ym, today);
  const facts: Fact[] = [];
  const add = (id: string, label: string, display: string, value: number, tone: Tone = 'neutral') =>
    facts.push({ id, label, display, value, tone });

  // Totals: the whole month, projected repeats included, exactly as Summary shows it.
  const exp = expense(month);
  const inc = income(month);
  add('expense-total', `Total spending in ${monthName}: ${money(exp)}`, money(exp), exp);
  if (inc > 0) add('income-total', `Total income in ${monthName}: ${money(inc)}`, money(inc), inc);
  const net = inc - exp;
  add(
    'net',
    `Net (income minus spending) in ${monthName}: ${signed(net, symbol)}`,
    signed(net, symbol),
    net,
    net > 0 ? 'positive' : net < 0 ? 'watch' : 'neutral',
  );

  // Comparisons: the current month vs the same point last month; past months whole.
  const prevYM = shiftMonth(ym, -1);
  const prevMonth = entriesForMonth(state, prevYM);
  const cutoff = isCurrent ? today.day : daysInMonth(y, m);
  const cur = upTo(month, cutoff);
  const prev = upTo(prevMonth, Math.min(cutoff, daysInMonth(prevYM.y, prevYM.m)));
  const when = isCurrent ? ' (same point in the month)' : '';
  if (elapsed > 0) {
    const curExp = expense(cur);
    const prevExp = expense(prev);
    if (prevExp > 0) {
      const v = pct(curExp, prevExp);
      add(
        'expense-vs-last',
        `Spending vs last month${when}: ${fmtPct(v)} (${money(curExp)} vs ${money(prevExp)})`,
        fmtPct(v),
        v,
        changeTone(v),
      );
    }
  }

  // Categories.
  const ranked = categoryBreakdown(month);
  if (ranked.length > 0) {
    add('top-category', `Top spending category in ${monthName}: ${ranked[0].category} (${money(ranked[0].total)})`, ranked[0].category, ranked[0].total);
    for (const slice of ranked.slice(0, 3)) {
      add(`cat-total:${slice.category}`, `${slice.category} spending in ${monthName}: ${money(slice.total)}`, money(slice.total), slice.total);
    }
  }
  if (elapsed > 0) {
    const curCats = expenseByCategory(cur);
    const prevCats = expenseByCategory(prev);
    let best: { cat: string; diff: number; now: number; before: number } | null = null;
    for (const [cat, before] of prevCats) {
      const now = curCats.get(cat) ?? 0;
      const diff = now - before;
      if (diff !== 0 && (!best || Math.abs(diff) > Math.abs(best.diff))) best = { cat, diff, now, before };
    }
    if (best) {
      const v = pct(best.now, best.before);
      add(
        `cat-pace:${best.cat}`,
        `${best.cat} spending vs last month${when}: ${fmtPct(v)} (${money(best.now)} vs ${money(best.before)})`,
        fmtPct(v),
        v,
        changeTone(v),
      );
    }
  }

  // Budget (only when one is set, in the active mode).
  const budget = budgetAmount(state);
  if (budget !== null) {
    const left = getRemainingBudget(state.budgetMode, state.budgets, state.totalBudget, month);
    add(
      'budget-left',
      left >= 0
        ? `Budget left for ${monthName}: ${money(left)} of ${money(budget)}`
        : `Spending is over the ${monthName} budget of ${money(budget)} by ${money(-left)}`,
      left >= 0 ? money(left) : `${MINUS}${money(-left)}`,
      left,
      left >= 0 ? 'positive' : 'watch',
    );
    if (elapsed > 0) {
      const used = Math.round((expense(upTo(month, elapsed)) / budget) * 100);
      const passed = Math.round((elapsed / daysInMonth(y, m)) * 100);
      add(
        'budget-pace',
        `Share of the monthly budget used so far: ${used}% (${passed}% of the month has passed)`,
        `${used}%`,
        used,
        used <= passed ? 'positive' : 'watch',
      );
    }
  }

  // Days.
  if (elapsed > 0) {
    const free = noSpendDays(month, ym, today);
    add('no-spend-days', `Days with no spending in ${monthName} so far: ${free}`, days(free, locale), free, free > 0 ? 'positive' : 'neutral');
  }
  if (isCurrent) {
    const streak = noSpendStreak(state, today);
    if (streak > 0) add('no-spend-streak', `Current run of days with no spending, up to today: ${streak}`, days(streak, locale), streak, 'positive');
  }
  if (elapsed > 0) {
    const perDay = new Map<number, number>();
    for (const t of upTo(month, elapsed)) {
      if (t.type === 'expense') perDay.set(t.day, (perDay.get(t.day) ?? 0) + t.amount);
    }
    let top: [number, number] | null = null;
    for (const [day, amt] of perDay) if (!top || amt > top[1] || (amt === top[1] && day < top[0])) top = [day, amt];
    if (top) {
      const when2 = `${MONTH_NAMES[m]} ${top[0]}`;
      add('biggest-day', `Biggest spending day in ${monthName}: ${when2} (${money(top[1])})`, money(top[1]), top[1]);
      add('biggest-day-date', `Date of the biggest spending day: ${when2}`, dateDisplay(m, top[0], locale), top[0]);
    }
    const count = upTo(month, elapsed).length;
    add('entry-count', `Entries in ${monthName} so far (repeats included): ${count}`, entriesCount(count, locale), count);
  }

  // A repeat rule created this month.
  const created = state.recurrenceRules
    .filter((r) => {
      if (r.timestampInferred) return false;
      const d = new Date(r.timestamp);
      return d.getFullYear() === y && d.getMonth() === m;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (created.length > 0) {
    const r = created[0];
    const name = r.note ? `${r.note} (${r.category})` : r.category;
    add(
      'new-repeat',
      `New ${r.repeat} repeating ${r.type} set up this month: ${name}, ${money(r.amount)} each time`,
      money(r.amount),
      r.amount,
    );
  }

  return facts;
}
