/**
 * Calendar grid math — pure date helpers for the month view. Weeks start on
 * Sunday (index 0), matching `Date.getDay()`, so `firstWeekday` doubles as the
 * count of leading blank cells before day 1.
 */
import type { YM } from './types';

/** Number of days in month `m` (0-based) of year `y`. */
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Weekday of the 1st (0 = Sunday … 6 = Saturday) — also the leading-blank count. */
export function firstWeekday(y: number, m: number): number {
  return new Date(y, m, 1).getDay();
}

/** Shift a year+month cursor by `delta` months, rolling the year over. */
export function shiftMonth(ym: YM, delta: number): YM {
  const d = new Date(ym.y, ym.m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

/** Clamp a day-of-month to the last valid day of (y, m) — e.g. Jan 31 → Feb 28. */
export function clampDay(day: number, y: number, m: number): number {
  return Math.min(Math.max(day, 1), daysInMonth(y, m));
}

/** Short weekday headers for the grid, Sunday-first. */
export const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Three-letter weekday names, Sunday-first — for the selected-day label. */
export const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Full + short month names, indexed by 0-based month. */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Selected-day label with weekday prefix, e.g. "Wed, Jul 2" (design §3). */
export function dayLabel(y: number, m: number, day: number): string {
  const wd = WEEKDAY_ABBR[new Date(y, m, day).getDay()];
  return `${wd}, ${MONTH_NAMES[m].slice(0, 3)} ${day}`;
}
