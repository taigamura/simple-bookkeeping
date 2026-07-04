/**
 * Domain tests (slice #3 acceptance criteria): formatting, aggregation, and the
 * keypad integer rules — all pure, no RN.
 */
import { yen, signed, code, MINUS } from './format';
import {
  monthEntries,
  dayEntries,
  dayNet,
  income,
  expense,
  net,
  signedAmount,
  makeEntry,
} from './entries';
import { daysInMonth, firstWeekday, shiftMonth, clampDay, dayLabel } from './calendar';
import { pressKey, amountValue } from './keypad';
import type { Transaction } from './types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: over.id ?? 'x',
  y: 2026,
  m: 6,
  day: 1,
  type: 'expense',
  amount: 100,
  category: 'Food',
  note: 'Food',
  repeat: 'never',
  ...over,
});

describe('yen', () => {
  it('rounds and comma-groups with the symbol', () => {
    expect(yen(1234.6, '¥')).toBe('¥1,235');
    expect(yen(1000000, '¥')).toBe('¥1,000,000');
    expect(yen(0, '$')).toBe('$0');
  });
});

describe('signed', () => {
  it('prefixes + for non-negative and the unicode minus for negative', () => {
    expect(signed(1200, '¥')).toBe('+¥1,200');
    expect(signed(-850, '¥')).toBe('−¥850');
    expect(signed(-850, '¥').startsWith(MINUS)).toBe(true);
    expect(signed(0, '¥')).toBe('+¥0');
  });

  it('uses the real unicode minus (U+2212), not an ASCII hyphen', () => {
    expect(signed(-5, '¥')).not.toContain('-'); // no ASCII hyphen
    expect(MINUS).toBe('−');
  });
});

describe('code', () => {
  it('is the first two chars uppercased', () => {
    expect(code('Food')).toBe('FO');
    expect(code('transport')).toBe('TR');
  });
});

describe('monthEntries / dayEntries / dayNet', () => {
  const entries = [
    tx({ id: 'a', y: 2026, m: 6, day: 2, type: 'income', amount: 1200 }),
    tx({ id: 'b', y: 2026, m: 6, day: 2, type: 'expense', amount: 850 }),
    tx({ id: 'c', y: 2026, m: 6, day: 5, type: 'expense', amount: 300 }),
    tx({ id: 'd', y: 2026, m: 7, day: 2, type: 'income', amount: 999 }), // August
  ];

  it('filters entries to a year+month', () => {
    const july = monthEntries(entries, { y: 2026, m: 6 });
    expect(july.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns [] for a month with no entries', () => {
    expect(monthEntries(entries, { y: 2026, m: 0 })).toEqual([]);
  });

  it('signedAmount is +income / -expense', () => {
    expect(signedAmount(tx({ type: 'income', amount: 1200 }))).toBe(1200);
    expect(signedAmount(tx({ type: 'expense', amount: 850 }))).toBe(-850);
  });

  it('dayNet sums the signed amounts for a day within the month', () => {
    const july = monthEntries(entries, { y: 2026, m: 6 });
    expect(dayEntries(july, 2).map((e) => e.id)).toEqual(['a', 'b']);
    expect(dayNet(july, 2)).toBe(1200 - 850); // 350
    expect(dayNet(july, 5)).toBe(-300);
    expect(dayNet(july, 9)).toBe(0);
  });

  it('income / expense / net aggregate the month totals', () => {
    const july = monthEntries(entries, { y: 2026, m: 6 });
    expect(income(july)).toBe(1200);
    expect(expense(july)).toBe(850 + 300);
    expect(net(july)).toBe(1200 - 1150); // 50
  });

  it('income / expense / net are 0 over an empty list', () => {
    expect(income([])).toBe(0);
    expect(expense([])).toBe(0);
    expect(net([])).toBe(0);
  });
});

describe('calendar grid math', () => {
  it('daysInMonth handles 31/30/leap/non-leap February', () => {
    expect(daysInMonth(2026, 6)).toBe(31); // July
    expect(daysInMonth(2026, 8)).toBe(30); // September
    expect(daysInMonth(2026, 1)).toBe(28); // Feb 2026 (non-leap)
    expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024 (leap)
  });

  it('firstWeekday returns the weekday of the 1st (0 = Sunday)', () => {
    expect(firstWeekday(2026, 6)).toBe(new Date(2026, 6, 1).getDay());
  });

  it('shiftMonth rolls the year over at the boundaries', () => {
    expect(shiftMonth({ y: 2026, m: 11 }, 1)).toEqual({ y: 2027, m: 0 });
    expect(shiftMonth({ y: 2026, m: 0 }, -1)).toEqual({ y: 2025, m: 11 });
    expect(shiftMonth({ y: 2026, m: 6 }, 1)).toEqual({ y: 2026, m: 7 });
  });

  it('clampDay caps a day to the last valid day of the month', () => {
    expect(clampDay(31, 2026, 1)).toBe(28); // Feb → 28
    expect(clampDay(15, 2026, 6)).toBe(15); // in range unchanged
    expect(clampDay(0, 2026, 6)).toBe(1); // floor at 1
  });

  it('dayLabel prefixes the weekday and short month (design §3)', () => {
    // 2026-07-02 is a Thursday; 2026-07-01 a Wednesday.
    expect(dayLabel(2026, 6, 2)).toBe('Thu, Jul 2');
    expect(dayLabel(2026, 6, 1)).toBe('Wed, Jul 1');
    expect(dayLabel(2026, 0, 15)).toBe('Thu, Jan 15');
  });
});

describe('makeEntry (save rules)', () => {
  const base = { type: 'expense' as const, category: 'Food', y: 2026, m: 6, day: 2 };

  it('returns null for a zero / empty amount (no-op)', () => {
    expect(makeEntry({ ...base, amountStr: '' })).toBeNull();
    expect(makeEntry({ ...base, amountStr: '0' })).toBeNull();
  });

  it('builds a transaction for a positive amount', () => {
    const e = makeEntry({ ...base, amountStr: '850' })!;
    expect(e).toMatchObject({ type: 'expense', amount: 850, category: 'Food', day: 2, m: 6, y: 2026 });
    expect(e.id).toBeTruthy();
  });

  it('falls back to the category when the note is empty or "—"', () => {
    expect(makeEntry({ ...base, amountStr: '5' })!.note).toBe('Food');
    expect(makeEntry({ ...base, amountStr: '5', note: '—' })!.note).toBe('Food');
    expect(makeEntry({ ...base, amountStr: '5', note: 'Lunch' })!.note).toBe('Lunch');
  });
});

describe('pressKey / amountValue (keypad integer rules)', () => {
  it('appends digits', () => {
    expect(pressKey('', '1')).toBe('1');
    expect(pressKey('12', '3')).toBe('123');
  });

  it('strips leading zeros', () => {
    expect(pressKey('', '0')).toBe('0');
    expect(pressKey('0', '0')).toBe('0');
    expect(pressKey('0', '5')).toBe('5');
    expect(pressKey('', '000')).toBe('0');
  });

  it('caps at 9 digits (over-cap presses ignored)', () => {
    expect(pressKey('123456789', '0')).toBe('123456789');
    expect(pressKey('12345678', '9')).toBe('123456789');
    expect(pressKey('999999999', '000')).toBe('999999999');
  });

  it('⌫ deletes the last digit', () => {
    expect(pressKey('123', 'del')).toBe('12');
    expect(pressKey('', 'del')).toBe('');
  });

  it('amountValue parses to an integer, 0 for empty', () => {
    expect(amountValue('')).toBe(0);
    expect(amountValue('0')).toBe(0);
    expect(amountValue('850')).toBe(850);
  });
});
