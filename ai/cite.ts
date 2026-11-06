/**
 * Fact-token rendering: model text says `{f:<id>}`, the screen shows the
 * fact's display string. Every number on screen therefore comes from code;
 * text that slips a digit past the tokens, cites an unknown fact, or scolds
 * is rejected (`null`) and the caller shows nothing.
 */
import type { Fact, Locale } from './contract';

/** id → display for the given facts. */
export function factDisplays(facts: Fact[]): Record<string, string> {
  return Object.fromEntries(facts.map((f) => [f.id, f.display]));
}

const TOKEN = /\{f:([^{}]+)\}/g;

/** Fact ids referenced by `text`, in first-seen order, each once. */
export function citedIds(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(TOKEN)) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

const DIGIT = /[0-9０-９]/;
const JA_BLOCK = ['使いすぎ', '無駄遣い', '浪費', 'ダメ', '反省しましょう', '我慢'];
const EN_BLOCK = /\b(overspent|wasteful|waste|bad|should have|failed)\b/i;
const EM_DASH = /\s*[—―]+\s*/g;
const JAPANESE = /[぀-ヿ㐀-鿿]/;

/** Kind, digit-free prose outside the tokens. */
function passesFilters(prose: string): boolean {
  if (DIGIT.test(prose)) return false;
  if (JA_BLOCK.some((w) => prose.includes(w))) return false;
  return !EN_BLOCK.test(prose);
}

/** Em dashes → 、 (JA) or ", " (EN). Locale defaults to a script guess. */
export function replaceEmDashes(text: string, locale?: Locale): string {
  const ja = locale ? locale === 'ja' : JAPANESE.test(text);
  return text.replace(EM_DASH, ja ? '、' : ', ');
}

/** Replace tokens with displays. `null` when the text cites an unknown fact,
 *  contains a literal digit outside tokens, or fails the kindness filter.
 *  `locale` (optional, additive) picks the em-dash replacement; without it the
 *  text's script decides. */
export function renderCited(
  text: string,
  displays: Record<string, string>,
  locale?: Locale,
): string | null {
  if (citedIds(text).some((id) => !(id in displays))) return null;
  if (!passesFilters(text.replace(TOKEN, ' '))) return null;
  const rendered = text.replace(TOKEN, (_m, id: string) => displays[id]);
  return replaceEmDashes(rendered, locale ?? (JAPANESE.test(text.replace(TOKEN, '')) ? 'ja' : 'en'));
}
