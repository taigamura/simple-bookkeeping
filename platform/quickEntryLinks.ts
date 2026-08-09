import type { EntryDraft } from '../domain';

export type QuickEntryDraft = EntryDraft;

function dateParts(value: string): { y: number; m: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(y, m, day));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m && date.getUTCDate() === day
    ? { y, m, day } : null;
}

export function parseQuickEntryUrl(raw: string): QuickEntryDraft | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'kaji-quick-entry:' || url.hostname !== 'new') return null;

  let payload: any = Object.fromEntries(url.searchParams.entries());
  if (url.searchParams.has('command')) {
    try { payload = JSON.parse(url.searchParams.get('command')!); } catch { return null; }
  }
  const date = payload.date && typeof payload.date === 'object'
    ? { y: Number(payload.date.y), m: Number(payload.date.m), day: Number(payload.date.day) }
    : dateParts(String(payload.date ?? ''));
  if (!date || !Number.isSafeInteger(date.y) || !Number.isSafeInteger(date.m)
    || !Number.isSafeInteger(date.day) || date.m < 0 || date.m > 11) return null;
  const amount = String(payload.amount ?? '');
  const category = String(payload.category ?? '').trim();
  if (!/^\d+$/.test(amount) || Number(amount) <= 0 || category.length === 0) return null;
  const calendarDate = new Date(Date.UTC(date.y, date.m, date.day));
  if (calendarDate.getUTCFullYear() !== date.y || calendarDate.getUTCMonth() !== date.m || calendarDate.getUTCDate() !== date.day) return null;
  return {
    type: 'expense', amountStr: amount, category, note: String(payload.note ?? ''),
    y: date.y, m: date.m, day: date.day, repeat: 'never',
  };
}
