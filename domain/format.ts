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

/** `code(cat)` = first two chars uppercased — the list-row icon tile label. */
export function code(category: string): string {
  return category.slice(0, 2).toUpperCase();
}
