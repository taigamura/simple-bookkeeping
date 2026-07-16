/**
 * Persistent recurrence behavior through the public ledger interface.
 */
import {
  deleteLedgerItem,
  entriesThrough,
  entriesForMonth,
  saveLedgerItem,
} from './recurrence';
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

describe('persistent recurrence', () => {
  it('projects an infinite monthly rule without losing its original day after February', () => {
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );

    expect(entriesForMonth(ledger, { y: 2027, m: 1 })).toEqual([
      expect.objectContaining({ y: 2027, m: 1, day: 28, repeat: 'monthly' }),
    ]);
    expect(entriesForMonth(ledger, { y: 2027, m: 2 })).toEqual([
      expect.objectContaining({ y: 2027, m: 2, day: 31, repeat: 'monthly' }),
    ]);
  });

  it('allows weekend movement to cross into the next month without changing its anchor', () => {
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2026, m: 0, day: 31, repeat: 'monthly' }),
      'after',
    );

    const moved = entriesForMonth(ledger, { y: 2026, m: 1 })[0];
    expect(moved).toMatchObject({ y: 2026, m: 1, day: 2 });
    expect(moved.occurrence?.scheduled).toEqual({ y: 2026, m: 0, day: 31 });
  });

  it('clamps a leap-day yearly rule and restores February 29 in leap years', () => {
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2024, m: 1, day: 29, repeat: 'yearly' }),
      'off',
    );

    expect(entriesForMonth(ledger, { y: 2025, m: 1 })[0].day).toBe(28);
    expect(entriesForMonth(ledger, { y: 2028, m: 1 })[0].day).toBe(29);
  });

  it('edits the selected recurring occurrence and all future occurrences only', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const march = entriesForMonth(original, { y: 2027, m: 2 })[0];

    const edited = saveLedgerItem(
      original,
      draft({ y: 2027, m: 2, day: 31, amountStr: '1200', repeat: 'monthly' }),
      'off',
      march,
    );

    expect(entriesForMonth(edited, { y: 2027, m: 1 })[0].amount).toBe(850);
    expect(entriesForMonth(edited, { y: 2027, m: 2 })[0].amount).toBe(1200);
    expect(entriesForMonth(edited, { y: 2027, m: 3 })[0]).toMatchObject({
      day: 30,
      amount: 1200,
    });
  });

  it('keeps future single-occurrence deletions when editing the same cadence', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const february = entriesForMonth(original, { y: 2027, m: 1 })[0];
    const march = entriesForMonth(original, { y: 2027, m: 2 })[0];
    const withMarchDeleted = deleteLedgerItem(original, march, 'one');

    const edited = saveLedgerItem(
      withMarchDeleted,
      draft({ y: 2027, m: 1, day: 28, amountStr: '1200', repeat: 'monthly' }),
      'off',
      february,
    );

    expect(entriesForMonth(edited, { y: 2027, m: 2 })).toEqual([]);
    expect(entriesForMonth(edited, { y: 2027, m: 3 })[0].amount).toBe(1200);
  });

  it('anchors a changed cadence to the displayed occurrence date', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2026, m: 0, day: 31, repeat: 'monthly' }),
      'after',
    );
    const movedToFebruary = entriesForMonth(original, { y: 2026, m: 1 })[0];

    const edited = saveLedgerItem(
      original,
      draft({ y: 2026, m: 1, day: 2, repeat: 'daily' }),
      'off',
      movedToFebruary,
    );

    expect(entriesForMonth(edited, { y: 2026, m: 0 })).toEqual([]);
    expect(entriesForMonth(edited, { y: 2026, m: 1 }).map((entry) => entry.day).slice(0, 2)).toEqual([
      2,
      3,
    ]);
  });

  it('turns the selected occurrence into a one-time entry when Repeat becomes Never', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const february = entriesForMonth(original, { y: 2027, m: 1 })[0];

    const edited = saveLedgerItem(
      original,
      draft({ y: 2027, m: 1, day: 28, repeat: 'never' }),
      'off',
      february,
    );

    const remaining = entriesForMonth(edited, { y: 2027, m: 1 });
    expect(remaining).toEqual([expect.objectContaining({ day: 28, repeat: 'never' })]);
    expect(remaining[0].occurrence).toBeUndefined();
    expect(entriesForMonth(edited, { y: 2027, m: 2 })).toEqual([]);
  });

  it('deletes only one recurring occurrence without changing later cadence', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const february = entriesForMonth(original, { y: 2027, m: 1 })[0];

    const edited = deleteLedgerItem(original, february, 'one');

    expect(entriesForMonth(edited, { y: 2027, m: 1 })).toEqual([]);
    expect(entriesForMonth(edited, { y: 2027, m: 2 })).toHaveLength(1);
  });

  it('deletes the selected recurring occurrence and every future occurrence', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const february = entriesForMonth(original, { y: 2027, m: 1 })[0];

    const edited = deleteLedgerItem(original, february, 'future');

    expect(entriesForMonth(edited, { y: 2027, m: 0 })).toHaveLength(1);
    expect(entriesForMonth(edited, { y: 2027, m: 1 })).toEqual([]);
    expect(entriesForMonth(edited, { y: 2028, m: 0 })).toEqual([]);
  });

  it('expands a daily rule from its exact start date through a finite export date', () => {
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 6, day: 15, repeat: 'daily' }),
      'off',
    );

    expect(entriesThrough(ledger, { y: 2027, m: 6, day: 17 }).map((entry) => entry.day)).toEqual([
      15,
      16,
      17,
    ]);
  });

  it('exports a first occurrence moved backward across a month boundary', () => {
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2026, m: 7, day: 1, repeat: 'monthly' }),
      'before',
    );

    expect(entriesThrough(ledger, { y: 2026, m: 6, day: 31 })).toEqual([
      expect.objectContaining({ y: 2026, m: 6, day: 31 }),
    ]);
  });
});
