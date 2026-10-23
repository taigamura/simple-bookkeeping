/**
 * Siri snapshot builder (ADR-0006). STUB — the domain slice implements it.
 */
import type { AppState } from '../store/schema';
import type { InboxEntry, Locale, SiriSnapshot, YMD } from './contract';

export function buildSiriSnapshot(
  state: AppState,
  today: YMD,
  locale: Locale,
  inbox: InboxEntry[],
  now: Date,
): SiriSnapshot {
  return {
    version: 1,
    generatedAt: now.toISOString(),
    locale,
    currency: { symbol: state.currency.symbol, code: state.currency.code },
    today: `${today.y}-${String(today.m + 1).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
    expCats: state.expCats,
    incCats: state.incCats,
    entries: [],
    months: {},
  };
}
