/**
 * Repeat suggestion (PRD #145, Calendar day panel). Pure; spots a payment the
 * user logs by hand every month so the app can offer to make it a repeat.
 *
 * A candidate is a cluster of concrete, non-repeat expense entries dated up to
 * today with the same normalized note (NFKC, trimmed, lower-cased, spaces
 * collapsed) and category, and an amount within ±5% of the cluster's first
 * (earliest) amount. It qualifies when it has ≥3 entries, every consecutive
 * gap is 28–34 days (a monthly cadence; the app has no weekly repeat), its
 * latest entry is at most 45 days old (a stopped subscription isn't
 * suggested), no active monthly rule already covers it, and its key isn't
 * dismissed. The most recent qualifying cluster wins; at most one suggestion.
 *
 * Key: `<note>|<category>|<first amount>`; it stays the same as later months
 * join the cluster, so a dismissal sticks.
 *
 * Fact ids: repeat-name (first: the note, or the category without one),
 * repeat-amount (latest amount), repeat-count.
 */
import { yen, type RecurrenceRule, type Transaction } from '../domain';
import type { AppState } from '../store/schema';
import type { Fact, Locale, YMD } from './contract';

export interface RepeatSuggestion {
  key: string;
  /** The latest matching entry: Accept edits it with repeat preset to monthly. */
  entry: Transaction;
  facts: Fact[];
}

const TOLERANCE = 0.05;
const MIN_GAP = 28;
const MAX_GAP = 34;
const MIN_COUNT = 3;
const MAX_AGE_DAYS = 45;
const DAY_MS = 86_400_000;

export const normalizeNote = (note: string) =>
  note.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

const dayNumber = (d: { y: number; m: number; day: number }) => Date.UTC(d.y, d.m, d.day) / DAY_MS;
const dateKey = (d: YMD) =>
  `${d.y}-${String(d.m + 1).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
const near = (a: number, anchor: number) => Math.abs(a - anchor) <= anchor * TOLERANCE;

function covered(rules: RecurrenceRule[], latest: Transaction, note: string, today: YMD): boolean {
  const todayKey = dateKey(today);
  return rules.some(
    (r) =>
      r.type === 'expense' &&
      r.repeat === 'monthly' &&
      r.category === latest.category &&
      normalizeNote(r.note) === note &&
      near(r.amount, latest.amount) &&
      (r.endsBefore === undefined || r.endsBefore > todayKey),
  );
}

export function suggestRepeat(
  state: AppState,
  today: YMD,
  dismissed: readonly string[],
  locale: Locale,
): RepeatSuggestion | null {
  const todayN = dayNumber(today);
  const pool = state.entries
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.occurrence == null &&
        (t.repeat ?? 'never') === 'never' &&
        dayNumber(t) <= todayN,
    )
    .sort((a, b) => dayNumber(a) - dayNumber(b) || a.id.localeCompare(b.id));

  // Cluster by (note, category), then by amount around each cluster's first amount.
  const clusters: { note: string; anchor: number; items: Transaction[] }[] = [];
  for (const t of pool) {
    const note = normalizeNote(t.note);
    const home = clusters.find((c) => c.note === note && c.items[0].category === t.category && near(t.amount, c.anchor));
    if (home) home.items.push(t);
    else clusters.push({ note, anchor: t.amount, items: [t] });
  }

  let best: { key: string; note: string; items: Transaction[] } | null = null;
  for (const c of clusters) {
    if (c.items.length < MIN_COUNT) continue;
    const latest = c.items[c.items.length - 1];
    if (todayN - dayNumber(latest) > MAX_AGE_DAYS) continue;
    let monthly = true;
    for (let i = 1; i < c.items.length; i++) {
      const gap = dayNumber(c.items[i]) - dayNumber(c.items[i - 1]);
      if (gap < MIN_GAP || gap > MAX_GAP) monthly = false;
    }
    if (!monthly) continue;
    if (covered(state.recurrenceRules, latest, c.note, today)) continue;
    const key = `${c.note}|${latest.category}|${c.anchor}`;
    if (dismissed.includes(key)) continue;
    if (!best) {
      best = { key, note: c.note, items: c.items };
      continue;
    }
    const prevLatest = best.items[best.items.length - 1];
    const diff = dayNumber(latest) - dayNumber(prevLatest);
    if (diff > 0 || (diff === 0 && key < best.key)) best = { key, note: c.note, items: c.items };
  }
  if (!best) return null;

  const entry = best.items[best.items.length - 1];
  const name = entry.note.trim() || entry.category;
  const count = best.items.length;
  const money = yen(entry.amount, state.currency.symbol);
  return {
    key: best.key,
    entry,
    facts: [
      {
        id: 'repeat-name',
        label: `A payment logged by hand about once a month: ${name} (${entry.category})`,
        display: name,
        value: count,
        tone: 'neutral',
      },
      {
        id: 'repeat-amount',
        label: `Its latest amount: ${money}`,
        display: money,
        value: entry.amount,
        tone: 'neutral',
      },
      {
        id: 'repeat-count',
        label: `Times it has been logged, a month apart: ${count}`,
        display: locale === 'ja' ? `${count}件` : `${count} entries`,
        value: count,
        tone: 'neutral',
      },
    ],
  };
}
