/**
 * Fact-token rendering: model text says `{f:<id>}`, the screen shows the
 * fact's display string. STUB — the domain slice implements it.
 */
import type { Fact } from './contract';

/** id → display for the given facts. */
export function factDisplays(facts: Fact[]): Record<string, string> {
  return Object.fromEntries(facts.map((f) => [f.id, f.display]));
}

/** Fact ids referenced by `text`. */
export function citedIds(_text: string): string[] {
  return [];
}

/** Replace tokens with displays. `null` when the text cites an unknown fact,
 *  contains a literal digit outside tokens, or fails the kindness filter. */
export function renderCited(text: string, _displays: Record<string, string>): string | null {
  return text;
}
