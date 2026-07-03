/**
 * Recurrence tests (slice #6): weekend-shift day adjustment and
 * materialize-on-save expansion (never / daily / monthly / yearly).
 */
import { shiftWeekendDay, materialize } from './recurrence';
import { daysInMonth } from './calendar';
import type { EntryDraft } from './entries';

// July 2026: the 1st is a Wednesday. Sat/Sun that month: 4,5 · 11,12 · 18,19 · 25,26.
const Y = 2026;
const M = 6; // July (0-based)

const draft = (over: Partial<EntryDraft> = {}): EntryDraft => ({
  type: 'expense',
  amountStr: '850',
  category: 'Food',
  note: '—',
  y: Y,
  m: M,
  day: 4,
  repeat: 'never',
  ...over,
});

describe('shiftWeekendDay', () => {
  it('leaves weekdays unchanged regardless of shift', () => {
    // July 1 2026 is a Wednesday.
    expect(shiftWeekendDay(Y, M, 1, 'after')).toBe(1);
    expect(shiftWeekendDay(Y, M, 1, 'before')).toBe(1);
    expect(shiftWeekendDay(Y, M, 1, 'off')).toBe(1);
  });

  it('moves a Saturday to Monday (+2) / Friday (-1)', () => {
    expect(new Date(Y, M, 4).getDay()).toBe(6); // Sat
    expect(shiftWeekendDay(Y, M, 4, 'after')).toBe(6); // → Mon
    expect(shiftWeekendDay(Y, M, 4, 'before')).toBe(3); // → Fri
  });

  it('moves a Sunday to Monday (+1) / Friday (-2)', () => {
    expect(new Date(Y, M, 5).getDay()).toBe(0); // Sun
    expect(shiftWeekendDay(Y, M, 5, 'after')).toBe(6); // → Mon
    expect(shiftWeekendDay(Y, M, 5, 'before')).toBe(3); // → Fri
  });

  it('keeps a weekend day when shift is off', () => {
    expect(shiftWeekendDay(Y, M, 4, 'off')).toBe(4);
  });
});

describe('materialize', () => {
  it('returns [] for a zero amount (no-op)', () => {
    expect(materialize(draft({ amountStr: '0' }))).toEqual([]);
    expect(materialize(draft({ amountStr: '' }))).toEqual([]);
  });

  it('never → a single entry on its day', () => {
    const out = materialize(draft({ repeat: 'never', day: 2 }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ day: 2, amount: 850, repeat: 'never' });
  });

  it('daily → one entry on every day of the month, each with a unique id', () => {
    const out = materialize(draft({ repeat: 'daily' }));
    expect(out).toHaveLength(daysInMonth(Y, M)); // 31 for July
    expect(out.map((e) => e.day)).toEqual(
      Array.from({ length: daysInMonth(Y, M) }, (_, i) => i + 1),
    );
    expect(new Set(out.map((e) => e.id)).size).toBe(out.length); // ids unique
    expect(out.every((e) => e.repeat === 'daily')).toBe(true);
  });

  it('monthly → a single entry on the weekend-adjusted day', () => {
    // day 4 (Sat) + move-to-Monday → day 6
    const out = materialize(draft({ repeat: 'monthly', day: 4 }), 'after');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ day: 6, repeat: 'monthly' });
  });

  it('yearly → a single entry, weekend shift off keeps the day', () => {
    const out = materialize(draft({ repeat: 'yearly', day: 5 }), 'off');
    expect(out).toHaveLength(1);
    expect(out[0].day).toBe(5);
  });

  it('note falls back to the category when left as "—"', () => {
    const out = materialize(draft({ repeat: 'never', note: '—', category: 'Food' }));
    expect(out[0].note).toBe('Food');
  });
});
