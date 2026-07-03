/**
 * Recurrence materialization (decision 2): materialize-on-save, current month
 * only — there is NO scheduler/recurrence engine. Saving expands a draft into
 * concrete `Transaction`s once:
 *   - `never`            → the single entry on its day
 *   - `daily`            → one entry on every day of the draft's month
 *   - `monthly`/`yearly` → one entry on the weekend-adjusted target day
 *
 * Weekend-shift (for monthly/yearly) maps `after` → Monday, `before` → Friday,
 * `off` → keep, and only moves when the target day falls on a weekend.
 */
import { clampDay, daysInMonth } from './calendar';
import { makeEntry, type EntryDraft } from './entries';
import { amountValue } from './keypad';
import type { Transaction, WeekendShift } from './types';

/** True for Sunday (0) or Saturday (6) in (y, m, day). */
function isWeekend(y: number, m: number, day: number): boolean {
  const wd = new Date(y, m, day).getDay();
  return wd === 0 || wd === 6;
}

/**
 * Weekend-adjusted day-of-month. If (y, m, day) is not a weekend, or `shift` is
 * `off`, the day is unchanged. `after` moves a weekend to the following Monday,
 * `before` to the preceding Friday. The result is clamped into the month.
 */
export function shiftWeekendDay(
  y: number,
  m: number,
  day: number,
  shift: WeekendShift,
): number {
  if (shift === 'off' || !isWeekend(y, m, day)) return day;
  const wd = new Date(y, m, day).getDay(); // 0 Sun, 6 Sat
  if (shift === 'after') {
    // → Monday: Sat (+2), Sun (+1)
    return clampDay(day + (wd === 6 ? 2 : 1), y, m);
  }
  // 'before' → Friday: Sat (-1), Sun (-2)
  return clampDay(day - (wd === 6 ? 1 : 2), y, m);
}

/**
 * Expand a draft into the entries to persist. Returns `[]` for a zero amount
 * (no-op). Each materialized entry gets its own id via `makeEntry`.
 */
export function materialize(
  draft: EntryDraft,
  weekendShift: WeekendShift = 'off',
): Transaction[] {
  if (amountValue(draft.amountStr) <= 0) return [];
  const repeat = draft.repeat ?? 'never';

  if (repeat === 'daily') {
    const out: Transaction[] = [];
    const total = daysInMonth(draft.y, draft.m);
    for (let d = 1; d <= total; d++) {
      const entry = makeEntry({ ...draft, day: d });
      if (entry) out.push(entry);
    }
    return out;
  }

  if (repeat === 'monthly' || repeat === 'yearly') {
    const day = shiftWeekendDay(draft.y, draft.m, draft.day, weekendShift);
    const entry = makeEntry({ ...draft, day });
    return entry ? [entry] : [];
  }

  const entry = makeEntry(draft);
  return entry ? [entry] : [];
}
