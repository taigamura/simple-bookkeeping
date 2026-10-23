/**
 * 「ChatGPTで聞く」: the prompt the user previews, then sends via the share
 * sheet. The numbers are computed here, in code; the outside AI is told not
 * to redo the arithmetic. Written in the user's locale, never with em dashes.
 */
import type { Fact, Locale, SnapshotEntry } from './contract';
import { replaceEmDashes } from './cite';

export interface HandoffInput {
  question: string;
  facts: Fact[];
  entries: SnapshotEntry[];
  locale: Locale;
}

/** Most entries the prompt carries. */
export const HANDOFF_MAX_ENTRIES = 60;

const COPY = {
  ja: {
    intro: '家計簿アプリSuitoのデータについて質問です。',
    question: '質問',
    facts: '集計（アプリで計算済み）',
    entries: '関連する記録（日付 / 種類 / カテゴリ / 金額 / メモ）',
    income: '収入',
    expense: '支出',
    repeat: '（繰り返し）',
    none: '（なし）',
    rule: '数値はすべてアプリで計算済みで正確です。再計算しないでください。この数値をそのまま使って、やさしく日本語で答えてください。',
  },
  en: {
    intro: 'A question about my data from the budgeting app Suito.',
    question: 'Question',
    facts: 'Totals (already computed by the app)',
    entries: 'Relevant entries (date / type / category / amount / note)',
    income: 'income',
    expense: 'expense',
    repeat: ' (repeat)',
    none: '(none)',
    rule: 'All numbers were already computed by the app and are exact. Do not recalculate them; use them as given and answer kindly in English.',
  },
} as const;

/** Entries whose category or note the question mentions. */
function isRelevant(e: SnapshotEntry, question: string): boolean {
  const q = question.toLowerCase();
  const cat = e.category.toLowerCase();
  const note = e.note.trim().toLowerCase();
  if (cat && q.includes(cat)) return true;
  if (note && q.includes(note)) return true;
  return q
    .split(/[\s、。,.!?！？「」]+/)
    .some((w) => w.length >= 2 && (note.includes(w) || cat.includes(w)));
}

function pickEntries(entries: SnapshotEntry[], question: string): SnapshotEntry[] {
  const newestFirst = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const relevant = newestFirst.filter((e) => isRelevant(e, question));
  const rest = newestFirst.filter((e) => !isRelevant(e, question));
  return [...relevant, ...rest]
    .slice(0, HANDOFF_MAX_ENTRIES)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function buildHandoffPrompt(input: HandoffInput): string {
  const { locale } = input;
  const c = COPY[locale];
  const clean = (s: string) => replaceEmDashes(s, locale);
  const lines: string[] = [c.intro, '', `${c.question}: ${clean(input.question.trim())}`, '', `${c.facts}:`];
  if (input.facts.length === 0) lines.push(c.none);
  for (const f of input.facts) lines.push(`- ${clean(f.label)}: ${clean(f.display)}`);
  lines.push('', `${c.entries}:`);
  const picked = pickEntries(input.entries, input.question);
  if (picked.length === 0) lines.push(c.none);
  for (const e of picked) {
    const note = e.note.trim() ? ` / ${clean(e.note.trim())}` : '';
    lines.push(
      `${e.date} / ${e.type === 'income' ? c.income : c.expense} / ${clean(e.category)} / ${e.amount}${note}${e.repeat ? c.repeat : ''}`,
    );
  }
  lines.push('', c.rule);
  return lines.join('\n');
}
