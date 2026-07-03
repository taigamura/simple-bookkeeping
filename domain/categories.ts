/**
 * Category & currency editing rules (slice #7). Pure list transforms used by the
 * Settings categories editor, plus the fixed currency choices.
 *
 * All operations return a new array (never mutate); callers persist the result.
 * These enforce the invariants from the spec: trimmed/deduped adds, a minimum of
 * one category, and neighbour-swap reordering.
 */
import type { Currency } from './types';

/** The four supported currencies (decision 11: symbol-swap only, no FX). */
export const CURRENCIES: Currency[] = [
  { symbol: '¥', code: 'JPY' },
  { symbol: '$', code: 'USD' },
  { symbol: '€', code: 'EUR' },
  { symbol: '£', code: 'GBP' },
];

/**
 * `addCategory(list, name)` — append a trimmed name, ignoring blanks and
 * case-insensitive duplicates (returns the list unchanged if it would dupe).
 */
export function addCategory(list: string[], name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return list;
  const exists = list.some((c) => c.toLowerCase() === trimmed.toLowerCase());
  return exists ? list : [...list, trimmed];
}

/**
 * `removeCategory(list, index)` — drop the entry at `index`, but keep at least
 * one category (returns the list unchanged when it holds a single item).
 */
export function removeCategory(list: string[], index: number): string[] {
  if (list.length <= 1) return list;
  if (index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

/**
 * `moveCategory(list, index, dir)` — swap the entry with its neighbour (dir
 * −1 = up, +1 = down). No-op at the ends or for an out-of-range index.
 */
export function moveCategory(
  list: string[],
  index: number,
  dir: -1 | 1,
): string[] {
  const target = index + dir;
  if (index < 0 || index >= list.length) return list;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
