/**
 * Persistent recurrence rules and their concrete projections. Rules are
 * unbounded; callers request only the month or finite history they need.
 * Scheduled dates remain separate from displayed dates so weekend movement can
 * cross month/year boundaries without changing the cadence anchor.
 */
import { clampDay, daysInMonth, shiftMonth } from './calendar';
import { makeEntry, uid, type EntryDraft } from './entries';
import type {
  Ledger,
  RecurrenceDate,
  RecurrenceRule,
  Repeat,
  Transaction,
  WeekendShift,
  YM,
} from './types';

export interface ActiveRecurrence {
  rule: RecurrenceRule;
  next: Transaction;
}

function dateKey(date: RecurrenceDate): string {
  return `${String(date.y).padStart(4, '0')}-${String(date.m + 1).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function compareDate(a: RecurrenceDate, b: RecurrenceDate): number {
  return a.y - b.y || a.m - b.m || a.day - b.day;
}

function nextDay(date: RecurrenceDate): RecurrenceDate {
  const value = new Date(date.y, date.m, date.day + 1);
  return { y: value.getFullYear(), m: value.getMonth(), day: value.getDate() };
}

function nextScheduledAfter(
  cutoff: RecurrenceDate,
  repeat: Exclude<Repeat, 'never'>,
  anchor: RecurrenceDate,
): RecurrenceDate {
  if (repeat === 'daily') return nextDay(cutoff);

  if (repeat === 'monthly') {
    let period = { y: cutoff.y, m: cutoff.m };
    let candidate = {
      ...period,
      day: clampDay(anchor.day, period.y, period.m),
    };
    if (compareDate(candidate, cutoff) <= 0) {
      period = shiftMonth(period, 1);
      candidate = {
        ...period,
        day: clampDay(anchor.day, period.y, period.m),
      };
    }
    return candidate;
  }

  let year = cutoff.y;
  let candidate = {
    y: year,
    m: anchor.m,
    day: clampDay(anchor.day, year, anchor.m),
  };
  if (compareDate(candidate, cutoff) <= 0) {
    year += 1;
    candidate = {
      y: year,
      m: anchor.m,
      day: clampDay(anchor.day, year, anchor.m),
    };
  }
  return candidate;
}

/** Active repeat segments paired with the next occurrence visible on the calendar. */
export function activeRecurrences(
  rules: RecurrenceRule[],
  today: RecurrenceDate,
): ActiveRecurrence[] {
  return rules
    .flatMap((rule) => {
      const next = nextVisibleOccurrence(rule, today);
      return next ? [{ rule, next }] : [];
    })
    .sort((a, b) => compareDate(a.next, b.next) || a.rule.id.localeCompare(b.rule.id));
}

function nextVisibleOccurrence(
  rule: RecurrenceRule,
  today: RecurrenceDate,
): Transaction | null {
  if (rule.repeat === 'daily') {
    let scheduled = compareDate(rule.start, today) > 0 ? rule.start : today;
    while (!rule.endsBefore || dateKey(scheduled) < rule.endsBefore) {
      const next = occurrence(rule, scheduled);
      if (next && compareDate(next, today) >= 0) return next;
      scheduled = nextDay(scheduled);
    }
    return null;
  }

  if (rule.repeat === 'monthly') {
    let period = shiftMonth({ y: today.y, m: today.m }, -1);
    while (true) {
      const scheduled = scheduledInPeriod(rule, period);
      if (rule.endsBefore && dateKey(scheduled) >= rule.endsBefore) return null;
      const next = occurrence(rule, scheduled);
      if (next && compareDate(next, today) >= 0) return next;
      period = shiftMonth(period, 1);
    }
  }

  let year = today.y - 1;
  while (true) {
    const scheduled = scheduledInPeriod(rule, { y: year, m: rule.start.m });
    if (rule.endsBefore && dateKey(scheduled) >= rule.endsBefore) return null;
    const next = occurrence(rule, scheduled);
    if (next && compareDate(next, today) >= 0) return next;
    year += 1;
  }
}

function shiftedDate(date: RecurrenceDate, shift: WeekendShift): RecurrenceDate {
  const value = new Date(date.y, date.m, date.day);
  const weekday = value.getDay();
  if (shift === 'off' || (weekday !== 0 && weekday !== 6)) return date;
  const delta =
    shift === 'after'
      ? weekday === 6
        ? 2
        : 1
      : weekday === 6
        ? -1
        : -2;
  value.setDate(value.getDate() + delta);
  return { y: value.getFullYear(), m: value.getMonth(), day: value.getDate() };
}

function occurrence(rule: RecurrenceRule, scheduled: RecurrenceDate): Transaction | null {
  const key = dateKey(scheduled);
  if (compareDate(scheduled, rule.start) < 0) return null;
  if (rule.endsBefore && key >= rule.endsBefore) return null;
  if (rule.exceptions.includes(key)) return null;
  const actual =
    rule.repeat === 'daily' ? scheduled : shiftedDate(scheduled, rule.weekendShift);
  return {
    id: `${rule.id}@${key}`,
    timestamp: rule.timestamp,
    ...(rule.timestampInferred ? { timestampInferred: true as const } : {}),
    ...actual,
    type: rule.type,
    amount: rule.amount,
    category: rule.category,
    note: rule.note,
    repeat: rule.repeat,
    occurrence: { ruleId: rule.id, scheduled, weekendShift: rule.weekendShift },
  };
}

function scheduledInPeriod(rule: RecurrenceRule, period: YM): RecurrenceDate {
  return {
    ...period,
    day: clampDay(rule.anchorDay, period.y, period.m),
  };
}

function ruleEntriesForMonth(rule: RecurrenceRule, month: YM): Transaction[] {
  if (rule.repeat === 'daily') {
    const entries: Transaction[] = [];
    for (let day = 1; day <= daysInMonth(month.y, month.m); day += 1) {
      const projected = occurrence(rule, { ...month, day });
      if (projected) entries.push(projected);
    }
    return entries;
  }

  const candidates: RecurrenceDate[] = [];
  if (rule.repeat === 'monthly') {
    for (const offset of [-1, 0, 1]) {
      candidates.push(scheduledInPeriod(rule, shiftMonth(month, offset)));
    }
  } else {
    for (const year of [month.y - 1, month.y, month.y + 1]) {
      candidates.push(scheduledInPeriod(rule, { y: year, m: rule.start.m }));
    }
  }

  return candidates
    .map((scheduled) => occurrence(rule, scheduled))
    .filter(
      (entry): entry is Transaction => entry !== null && entry.y === month.y && entry.m === month.m,
    );
}

/**
 * Persist a one-time entry or an unbounded recurrence rule from one draft.
 *
 * `scope` only matters when editing a projected occurrence (`editing.occurrence`
 * set) and only changes which future occurrences pick up the new values:
 *
 * - `'future'` (default): this occurrence and every later one — truncates the
 *   source rule at the edited occurrence's original date and starts a new rule
 *   (or a one-time entry, if the draft turns off repeat) from there. This is
 *   the only behavior this function had before `scope` existed.
 * - `'one'`: only this occurrence. The source rule is left otherwise
 *   untouched — future projections keep its existing cadence and values —
 *   and gets an exception added for the original scheduled date, alongside a
 *   standalone one-time replacement entry carrying the edited values. A
 *   single occurrence has no cadence of its own, so `draft.repeat` is not
 *   consulted for this scope; the replacement is always non-repeating.
 *
 * Ignored for every other edit (a plain entry, a legacy materialized repeat
 * with no rule link, or a brand new item) — none of those have a rule to
 * split "one" from "future" against.
 */
export function saveLedgerItem(
  ledger: Ledger,
  draft: EntryDraft,
  weekendShift: WeekendShift = 'off',
  editing?: Transaction,
  scope: 'one' | 'future' = 'future',
): Ledger {
  const normalized = makeEntry(draft);
  if (!normalized) return ledger;

  if (editing?.occurrence) {
    const source = ledger.recurrenceRules.find(
      (rule) => rule.id === editing.occurrence!.ruleId,
    );
    if (!source) return ledger;
    const cutoff = dateKey(editing.occurrence.scheduled);

    if (scope === 'one') {
      const recurrenceRules = ledger.recurrenceRules.map((rule) =>
        rule.id === source.id && !rule.exceptions.includes(cutoff)
          ? { ...rule, exceptions: [...rule.exceptions, cutoff] }
          : rule,
      );
      // The date field defaults to the rule's raw scheduled anchor, not the
      // weekend-shifted date the occurrence actually *displays* on (see
      // EntrySheet's date-field default) — a one-time replacement has no
      // weekend-shift concept of its own to re-derive that display date from,
      // so an untouched field would silently land it back on the unshifted
      // day instead of the day the user found and opened it on. Land on the
      // displayed date instead when the field wasn't touched; an explicit
      // date edit is honored exactly as typed.
      const dateFieldUntouched =
        compareDate({ y: draft.y, m: draft.m, day: draft.day }, editing.occurrence.scheduled) === 0;
      const landingDate = dateFieldUntouched
        ? { y: editing.y, m: editing.m, day: editing.day }
        : { y: draft.y, m: draft.m, day: draft.day };
      return {
        entries: [
          ...ledger.entries,
          {
            ...normalized,
            ...landingDate,
            timestamp: draft.timestamp ?? editing.timestamp,
            ...(draft.timestamp
              ? {}
              : editing.timestampInferred
                ? { timestampInferred: true as const }
                : {}),
            repeat: 'never',
          },
        ],
        recurrenceRules,
      };
    }

    const nextStart = { y: draft.y, m: draft.m, day: draft.day };
    const movesBackward = compareDate(nextStart, editing.occurrence.scheduled) < 0;
    const recurrenceRules = ledger.recurrenceRules.map((rule) =>
      rule.id === source.id ? { ...rule, endsBefore: cutoff } : rule,
    );
    if (!draft.repeat || draft.repeat === 'never') {
      return {
        entries: [
          ...ledger.entries,
          {
            ...normalized,
            timestamp: draft.timestamp ?? editing.timestamp,
            ...(draft.timestamp
              ? {}
              : editing.timestampInferred
                ? { timestampInferred: true as const }
                : {}),
            repeat: 'never',
          },
        ],
        recurrenceRules,
      };
    }
    const sameCadence = draft.repeat === source.repeat;
    const dateChanged = compareDate(nextStart, editing.occurrence.scheduled) !== 0;
    const ruleStart = movesBackward
      ? nextScheduledAfter(editing.occurrence.scheduled, draft.repeat, nextStart)
      : nextStart;
    const ruleId = movesBackward ? uid() : normalized.id;
    return {
      entries: movesBackward
        ? [
            ...ledger.entries,
            {
              ...normalized,
              timestamp: draft.timestamp ?? editing.timestamp,
              ...(draft.timestamp
                ? {}
                : editing.timestampInferred
                  ? { timestampInferred: true as const }
                  : {}),
              repeat: 'never',
            },
          ]
        : ledger.entries,
      recurrenceRules: [
        ...recurrenceRules,
        {
          id: ruleId,
          timestamp: draft.timestamp ?? editing.timestamp,
          ...(draft.timestamp
            ? {}
            : editing.timestampInferred
              ? { timestampInferred: true as const }
              : {}),
          start: ruleStart,
          anchorDay: sameCadence && !dateChanged ? source.anchorDay : nextStart.day,
          type: normalized.type,
          amount: normalized.amount,
          category: normalized.category,
          note: normalized.note,
          repeat: draft.repeat,
          weekendShift,
          exceptions: sameCadence && !dateChanged
            ? source.exceptions.filter((exception) => exception >= cutoff)
            : [],
          endsBefore: source.endsBefore,
        },
      ],
    };
  }

  if (editing) {
    if (!draft.repeat || draft.repeat === 'never') {
      return {
        ...ledger,
        entries: ledger.entries.map((entry) =>
          entry.id === editing.id
            ? {
                ...editing,
                y: normalized.y,
                m: normalized.m,
                day: normalized.day,
                timestamp: normalized.timestamp,
                type: normalized.type,
                amount: normalized.amount,
                category: normalized.category,
                note: normalized.note,
                repeat: 'never',
              }
            : entry,
        ),
      };
    }
    const entries = ledger.entries.filter((entry) => entry.id !== editing.id);
    const start = { y: draft.y, m: draft.m, day: draft.day };
    return {
      entries,
      recurrenceRules: [
        ...ledger.recurrenceRules,
        {
          id: normalized.id,
          timestamp: draft.timestamp ?? editing.timestamp,
          ...(draft.timestamp
            ? {}
            : editing.timestampInferred
              ? { timestampInferred: true as const }
              : {}),
          start,
          anchorDay: start.day,
          type: normalized.type,
          amount: normalized.amount,
          category: normalized.category,
          note: normalized.note,
          repeat: draft.repeat,
          weekendShift,
          exceptions: [],
        },
      ],
    };
  }

  if (!draft.repeat || draft.repeat === 'never') {
    return { ...ledger, entries: [...ledger.entries, normalized] };
  }
  const rule: RecurrenceRule = {
    id: normalized.id,
    timestamp: normalized.timestamp,
    start: { y: draft.y, m: draft.m, day: draft.day },
    anchorDay: draft.day,
    type: normalized.type,
    amount: normalized.amount,
    category: normalized.category,
    note: normalized.note,
    repeat: draft.repeat,
    weekendShift,
    exceptions: [],
  };
  return { ...ledger, recurrenceRules: [...ledger.recurrenceRules, rule] };
}

/** Concrete one-time and projected recurring transactions for one month. */
export function entriesForMonth(ledger: Ledger, month: YM): Transaction[] {
  return [
    ...ledger.entries.filter((entry) => entry.y === month.y && entry.m === month.m),
    ...ledger.recurrenceRules.flatMap((rule) => ruleEntriesForMonth(rule, month)),
  ];
}

/** Remove one concrete occurrence or truncate its rule from that instance. */
export function deleteLedgerItem(
  ledger: Ledger,
  entry: Transaction,
  scope: 'one' | 'future' = 'one',
): Ledger {
  if (!entry.occurrence) {
    return {
      ...ledger,
      entries: ledger.entries.filter((candidate) => candidate.id !== entry.id),
    };
  }
  const key = dateKey(entry.occurrence.scheduled);
  return {
    ...ledger,
    recurrenceRules: ledger.recurrenceRules.map((rule) => {
      if (rule.id !== entry.occurrence!.ruleId) return rule;
      if (scope === 'future') return { ...rule, endsBefore: key };
      return rule.exceptions.includes(key)
        ? rule
        : { ...rule, exceptions: [...rule.exceptions, key] };
    }),
  };
}

/** Concrete ledger history through an inclusive date (used by finite exports). */
export function entriesThrough(ledger: Ledger, end: RecurrenceDate): Transaction[] {
  const projected: Transaction[] = [];
  const starts = ledger.recurrenceRules
    .map((rule) => rule.start)
    .sort(compareDate);
  if (starts.length > 0) {
    // A first monthly/yearly occurrence may move to Friday in the preceding
    // month, so finite history starts projecting one month before its nominal
    // rule start.
    let month = shiftMonth({ y: starts[0].y, m: starts[0].m }, -1);
    while (month.y < end.y || (month.y === end.y && month.m <= end.m)) {
      projected.push(
        ...ledger.recurrenceRules.flatMap((rule) => ruleEntriesForMonth(rule, month)),
      );
      month = shiftMonth(month, 1);
    }
  }
  return [
    ...ledger.entries.filter((entry) => compareDate(entry, end) <= 0),
    ...projected.filter((entry) => compareDate(entry, end) <= 0),
  ].sort(
    (a, b) => compareDate(a, b) || a.id.localeCompare(b.id),
  );
}
