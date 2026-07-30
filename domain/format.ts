/**
 * Money formatting (build-decisions "Formatting"). Integer-only, `en-US` comma
 * grouping, symbol-only currency. `signed` uses the real unicode minus (−,
 * U+2212), not an ASCII hyphen, per the design.
 */
import { DEFAULT_CURRENCY } from './defaults';

/** Unicode minus sign (U+2212), visually balanced against the plus. */
export const MINUS = '−';

/**
 * `yen(n)` = symbol + rounded, comma-grouped integer. Callers pass a magnitude;
 * sign is applied separately by `signed`.
 */
export function yen(n: number, symbol: string = DEFAULT_CURRENCY.symbol): string {
  return symbol + Math.round(n).toLocaleString('en-US');
}

/**
 * `signed(n)` = +/− prefix then the formatted magnitude, e.g. `+¥1,200`,
 * `−¥850`. Zero is rendered as a positive `+¥0`.
 */
export function signed(n: number, symbol: string = DEFAULT_CURRENCY.symbol): string {
  const sign = n < 0 ? MINUS : '+';
  return sign + yen(Math.abs(n), symbol);
}

/** `code(cat)` = first two chars uppercased — the Settings category tile label. */
export function code(category: string): string {
  return category.slice(0, 2).toUpperCase();
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * `stamp(iso)` = `YYYY/MM/DD HH:MM` in the device's local time — the day-list
 * row's timestamp. Assembled from the local date getters rather than `Intl` so
 * the pattern is fixed in every locale (`Intl` would render the same instant as
 * `21/07/2026` or `2026/7/21` depending on the device). An unparseable
 * timestamp renders as empty rather than `Invalid Date`.
 */
export function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
