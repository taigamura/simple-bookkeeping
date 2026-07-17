/**
 * Persistent recurrence rules and their concrete projections. Rules are
 * unbounded; callers request only the month or finite history they need.
 * Scheduled dates remain separate from displayed dates so weekend movement can
 * cross month/year boundaries without changing the cadence anchor.
 */
import { clampDay, daysInMonth, shiftMonth } from './calendar';
import { makeEntry, type EntryDraft } from './entries';
import type {
  Ledger,
  RecurrenceDate,
  RecurrenceRule,
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

/** Persist a one-time entry or an unbounded recurrence rule from one draft. */
export function saveLedgerItem(
  ledger: Ledger,
  draft: EntryDraft,
  weekendShift: WeekendShift = 'off',
  editing?: Transaction,
): Ledger {
  const normalized = makeEntry(draft);
  if (!normalized) return ledger;

  if (editing?.occurrence) {
    const source = ledger.recurrenceRules.find(
      (rule) => rule.id === editing.occurrence!.ruleId,
    );
    if (!source) return ledger;
    const cutoff = dateKey(editing.occurrence.scheduled);
    const recurrenceRules = ledger.recurrenceRules.map((rule) =>
      rule.id === source.id ? { ...rule, endsBefore: cutoff } : rule,
    );
    if (!draft.repeat || draft.repeat === 'never') {
      return {
        entries: [
          ...ledger.entries,
          {
            ...normalized,
            y: editing.y,
            m: editing.m,
            day: editing.day,
            repeat: 'never',
          },
        ],
        recurrenceRules,
      };
    }
    const sameCadence = draft.repeat === source.repeat;
    const nextStart = editing.occurrence.scheduled;
    return {
      entries: ledger.entries,
      recurrenceRules: [
        ...recurrenceRules,
        {
          id: normalized.id,
          start: nextStart,
          anchorDay: sameCadence ? source.anchorDay : nextStart.day,
          type: normalized.type,
          amount: normalized.amount,
          category: normalized.category,
          note: normalized.note,
          repeat: draft.repeat,
          weekendShift,
          exceptions: sameCadence
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
    const start = { y: editing.y, m: editing.m, day: editing.day };
    return {
      entries,
      recurrenceRules: [
        ...ledger.recurrenceRules,
        {
          id: normalized.id,
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
