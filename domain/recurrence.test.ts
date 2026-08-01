/**
 * Persistent recurrence behavior through the public ledger interface.
 */
import {
  activeRecurrences,
  deleteLedgerItem,
  entriesThrough,
  entriesForMonth,
  saveLedgerItem,
} from './recurrence';
import { makeEntry, type EntryDraft } from './entries';

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
  it('lists only repeat segments with a visible occurrence today or later', () => {
    const active = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2026, m: 6, day: 17, repeat: 'daily' }),
      'off',
    );
    const ended = {
      ...active.recurrenceRules[0],
      id: 'ended',
      start: { y: 2026, m: 6, day: 1 },
      endsBefore: '2026-07-17',
    };

    expect(
      activeRecurrences([ended, active.recurrenceRules[0]], { y: 2026, m: 6, day: 17 }),
    ).toEqual([
      expect.objectContaining({
        rule: active.recurrenceRules[0],
        next: expect.objectContaining({ y: 2026, m: 6, day: 17 }),
      }),
    ]);
  });

  it('skips a weekend-shifted monthly occurrence already displayed before today', () => {
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2026, m: 6, day: 19, repeat: 'monthly' }),
      'before',
    );

    expect(
      activeRecurrences(ledger.recurrenceRules, { y: 2026, m: 6, day: 18 })[0].next,
    ).toMatchObject({ y: 2026, m: 7, day: 19 });
  });

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

  it('gives every projected item its recurrence rule timestamp', () => {
    const ledger = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );

    expect(ledger.recurrenceRules[0].timestamp).toBeTruthy();
    expect(entriesForMonth(ledger, { y: 2027, m: 1 })[0].timestamp).toBe(
      ledger.recurrenceRules[0].timestamp,
    );
  });

  it('preserves the item timestamp when an edit changes its recurrence shape', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const timestamp = original.recurrenceRules[0].timestamp;
    const february = entriesForMonth(original, { y: 2027, m: 1 })[0];

    const splitRule = saveLedgerItem(
      original,
      draft({ y: 2027, m: 1, day: 28, repeat: 'daily' }),
      'off',
      february,
    );
    expect(splitRule.recurrenceRules.at(-1)?.timestamp).toBe(timestamp);

    const oneTime = saveLedgerItem(
      original,
      draft({ y: 2027, m: 1, day: 28, repeat: 'never' }),
      'off',
      february,
    );
    expect(oneTime.entries.at(-1)?.timestamp).toBe(timestamp);

    const sourceEntry = makeEntry(draft({ repeat: 'never' }), timestamp)!;
    const promoted = saveLedgerItem(
      { entries: [sourceEntry], recurrenceRules: [] },
      draft({ repeat: 'daily' }),
      'off',
      sourceEntry,
    );
    expect(promoted.recurrenceRules[0].timestamp).toBe(timestamp);
  });

  it('moves a one-time entry to the edited date', () => {
    const original = makeEntry(draft())!;
    const edited = saveLedgerItem(
      { entries: [original], recurrenceRules: [] },
      draft({ y: 2030, m: 11, day: 24 }),
      'off',
      original,
    );

    expect(edited.entries[0]).toMatchObject({ y: 2030, m: 11, day: 24 });
    expect(edited.entries[0].timestamp).toBe(original.timestamp);
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

  it('edits only the selected occurrence, leaving the rule and its other months alone (scope: one)', () => {
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
      'one',
    );

    // The edited month shows the standalone replacement, one-time and at the
    // new values; every other month still projects from the untouched rule.
    expect(entriesForMonth(edited, { y: 2027, m: 1 })[0]).toMatchObject({
      amount: 850,
      repeat: 'monthly',
    });
    expect(entriesForMonth(edited, { y: 2027, m: 2 })[0]).toMatchObject({
      amount: 1200,
      repeat: 'never',
    });
    expect(entriesForMonth(edited, { y: 2027, m: 3 })[0]).toMatchObject({
      day: 30, // April clamps the 31-anchor day, same as the untouched rule always did.
      amount: 850,
      repeat: 'monthly',
    });
    // The rule itself is untouched apart from gaining the one exception —
    // still open-ended, still the original cadence and values.
    expect(edited.recurrenceRules).toEqual([
      { ...original.recurrenceRules[0], exceptions: ['2027-03-31'] },
    ]);
  });

  it('moves a single-occurrence edit to a new date without disturbing the rule (scope: one)', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const march = entriesForMonth(original, { y: 2027, m: 2 })[0];

    const edited = saveLedgerItem(
      original,
      draft({ y: 2027, m: 2, day: 15, amountStr: '1200', repeat: 'monthly' }),
      'off',
      march,
      'one',
    );

    // The rule stops generating on its original March date (the exception is
    // keyed on the *scheduled* date, not wherever the replacement landed)...
    expect(entriesForMonth(edited, { y: 2027, m: 2 })).toEqual([
      expect.objectContaining({ day: 15, amount: 1200, repeat: 'never' }),
    ]);
    // ...and the rule's cadence for every other month is untouched.
    expect(entriesForMonth(edited, { y: 2027, m: 3 })[0]).toMatchObject({
      day: 30,
      amount: 850,
      repeat: 'monthly',
    });
  });

  it('ignores the draft repeat cadence for a scope-one edit — a single occurrence cannot repeat', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const march = entriesForMonth(original, { y: 2027, m: 2 })[0];

    // The form still shows the ongoing cadence (yearly here, mismatched from
    // the rule's monthly on purpose) since scope is chosen after Save, not
    // via the form — scope: 'one' must not let that leak into the rule.
    const edited = saveLedgerItem(
      original,
      draft({ y: 2027, m: 2, day: 31, amountStr: '1200', repeat: 'yearly' }),
      'off',
      march,
      'one',
    );

    expect(edited.recurrenceRules).toHaveLength(1);
    expect(edited.recurrenceRules[0].repeat).toBe('monthly');
    expect(entriesForMonth(edited, { y: 2027, m: 2 })[0].repeat).toBe('never');
  });

  it('lands a scope-one edit on the weekend-shifted display date, not the raw anchor', () => {
    // July 4, 2026 is a Saturday; 'after' shifts display to Monday the 6th.
    // The Entry sheet's date field defaults to the *raw* scheduled anchor
    // (day 4) — a scope-one save that leaves the field untouched must not
    // silently plant the replacement back on that unshifted Saturday, since
    // the user found and opened this occurrence on the Monday it displays on.
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: Y, m: M, day: 4, repeat: 'monthly' }),
      'after',
    );
    const july = entriesForMonth(original, { y: Y, m: M })[0];
    expect(july.day).toBe(6); // sanity: confirms the fixture actually shifted

    // Mirrors what EntrySheet actually submits when the date field is left
    // alone: draft.y/m/day equal to the occurrence's raw *scheduled* date,
    // not its shifted display date.
    const edited = saveLedgerItem(
      original,
      draft({ y: Y, m: M, day: july.occurrence!.scheduled.day, amountStr: '1200', repeat: 'monthly' }),
      'after',
      july,
      'one',
    );

    expect(entriesForMonth(edited, { y: Y, m: M })).toEqual([
      expect.objectContaining({ day: 6, amount: 1200, repeat: 'never' }),
    ]);
    // The rule is untouched and still projects (and still shifts) normally
    // for every other month.
    expect(entriesForMonth(edited, { y: Y, m: M + 1 })[0]).toMatchObject({ amount: 850 });
  });

  it('honors an explicit date change for a scope-one edit, without re-applying the display shift', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: Y, m: M, day: 4, repeat: 'monthly' }),
      'after',
    );
    const july = entriesForMonth(original, { y: Y, m: M })[0];

    // The user explicitly retypes the date to the 10th — that is an
    // intentional choice and must be honored exactly, not treated as "field
    // untouched" and redirected back to the shifted display date.
    const edited = saveLedgerItem(
      original,
      draft({ y: Y, m: M, day: 10, amountStr: '1200', repeat: 'monthly' }),
      'after',
      july,
      'one',
    );

    expect(entriesForMonth(edited, { y: Y, m: M })).toEqual([
      expect.objectContaining({ day: 10, amount: 1200, repeat: 'never' }),
    ]);
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

  it('anchors a changed cadence to the edited date', () => {
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
    expect(entriesForMonth(edited, { y: 2026, m: 1 }).map((entry) => entry.day).slice(0, 2)).toEqual([2, 3]);
  });

  it('anchors an unchanged cadence to a newly edited date', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const february = entriesForMonth(original, { y: 2027, m: 1 })[0];

    const edited = saveLedgerItem(
      original,
      draft({ y: 2027, m: 2, day: 15, repeat: 'monthly' }),
      'off',
      february,
    );

    expect(edited.recurrenceRules.at(-1)).toMatchObject({
      start: { y: 2027, m: 2, day: 15 },
      anchorDay: 15,
    });
    expect(entriesForMonth(edited, { y: 2027, m: 1 })).toEqual([]);
    expect(entriesForMonth(edited, { y: 2027, m: 2 })).toEqual([
      expect.objectContaining({ day: 15, repeat: 'monthly' }),
    ]);
    expect(entriesForMonth(edited, { y: 2027, m: 3 })[0].day).toBe(15);
  });

  it('moves a recurring occurrence backward without rewriting prior history', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2027, m: 0, day: 31, repeat: 'monthly' }),
      'off',
    );
    const february = entriesForMonth(original, { y: 2027, m: 1 })[0];

    const edited = saveLedgerItem(
      original,
      draft({ y: 2027, m: 0, day: 15, repeat: 'monthly' }),
      'off',
      february,
    );

    expect(entriesForMonth(edited, { y: 2027, m: 0 })).toEqual([
      expect.objectContaining({ day: 15, repeat: 'never' }),
      expect.objectContaining({ day: 31, repeat: 'monthly' }),
    ]);
    expect(entriesForMonth(edited, { y: 2027, m: 1 })).toEqual([]);
    expect(entriesForMonth(edited, { y: 2027, m: 2 })).toEqual([
      expect.objectContaining({ day: 15, repeat: 'monthly' }),
    ]);
  });

  it('preserves a bounded segment cutoff when editing its future occurrences', () => {
    const original = saveLedgerItem(
      { entries: [], recurrenceRules: [] },
      draft({ y: 2026, m: 6, day: 20, repeat: 'daily' }),
      'off',
    );
    original.recurrenceRules[0].endsBefore = '2026-07-23';
    const next = activeRecurrences(
      original.recurrenceRules,
      { y: 2026, m: 6, day: 21 },
    )[0].next;

    const edited = saveLedgerItem(
      original,
      draft({ y: 2026, m: 6, day: 21, amountStr: '1200', repeat: 'daily' }),
      'off',
      next,
    );

    expect(edited.recurrenceRules.at(-1)?.endsBefore).toBe('2026-07-23');
    expect(entriesForMonth(edited, { y: 2026, m: 6 }).map((entry) => entry.day)).toEqual([
      20,
      21,
      22,
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
