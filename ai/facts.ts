/**
 * Fact sheet: the only numbers the models may cite (ADR-0006).
 * STUB — signature is the contract; the domain slice implements it.
 */
import type { AppState } from '../store/schema';
import type { Fact, Locale, YMD } from './contract';

/** Facts about month (y, m) as of `today` (past months are complete). */
export function buildFacts(_state: AppState, _y: number, _m: number, _today: YMD, _locale: Locale): Fact[] {
  return [];
}
