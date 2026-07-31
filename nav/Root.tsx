/**
 * Root — the bespoke navigation host (decision 3). Owns the nav state (`tab`,
 * `sheet`) and the calendar cursor (current month + selected day), renders the
 * active screen, the custom TabBar, and the Entry/Settings sheets. No router.
 *
 * Store `state`/`update` are threaded in from `App` (single source of truth) so
 * the ledger and category seeds flow to the screens and new entries persist.
 * Month navigation is fixed to the current month here; it arrives in slice #4.
 */
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import {
  activeRecurrences,
  clampDay,
  decodeZaimBytes,
  deleteLedgerItem,
  entriesForMonth,
  entriesThrough,
  parseZaimCsv,
  promoteCategory,
  pruneBudgets,
  saveLedgerItem,
  serializeZaimCsv,
  shiftMonth,
  type Currency,
  type EntryDraft,
  type Transaction,
  type WeekendShift,
  type YM,
  type ZaimSkipTally,
} from '../domain';
import { strings } from '../i18n';
import { entrySaved } from '../platform/haptics';
import { shareTextFile } from '../platform/shareFile';
import { useToday } from '../platform/useToday';
import { BudgetsSheet } from '../screens/BudgetsSheet';
import { CalendarScreen } from '../screens/CalendarScreen';
import { EntrySheet } from '../screens/EntrySheet';
import { RepeatsSheet } from '../screens/RepeatsSheet';
import { SettingsSheet } from '../screens/SettingsSheet';
import { SummaryScreen } from '../screens/SummaryScreen';
import type { AppState, UseStore } from '../store';
import { easings, metrics, useMotion, withAppTiming } from '../theme';
import { AppShell } from './AppShell';
import { BottomSheet, SHEET_ANIMATION_DURATION } from './BottomSheet';
import { TabBar } from './TabBar';
import type { Sheet, Tab } from './types';

interface RootProps {
  state: AppState;
  update: (patch: Partial<AppState>) => void;
  /** True for this session if boot's load() stashed an unreadable blob (#28). */
  showCorruptNotice: boolean;
  /** Whether a corrupt-stash blob exists — gates the Settings recovery row. */
  hasCorruptStash: boolean;
  readCorruptStash: () => Promise<string | null>;
  persistenceNotice?: UseStore['persistenceNotice'];
}

// RN Web's Alert.alert is a no-op stub (react-native-web has no dialog
// implementation), so a plain Alert-only confirmation would silently do
// nothing on web — this project's primary verification platform. These two
// helpers fall back to the browser's window.alert/confirm there.
function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

// skipSummary(): renders the Zaim skip tally as a trailing clause, e.g.
// " — 12 transfers skipped, 10 malformed rows skipped" (empty when nothing
// was skipped) so the confirmation shows a breakdown by reason, not just an
// opaque "some rows were skipped".
function skipSummary(skipped: ZaimSkipTally): string {
  const { skip } = strings.zaim;
  const parts: string[] = [];
  if (skipped.transfer > 0) parts.push(skip.transfer(skipped.transfer));
  if (skipped.balanceAdjustment > 0) parts.push(skip.balanceAdjustment(skipped.balanceAdjustment));
  if (skipped.malformed > 0) parts.push(skip.malformedRow(skipped.malformed));
  if (skipped.duplicate > 0) parts.push(skip.duplicate(skipped.duplicate));
  return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
}

function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel: string = strings.common.import,
  destructive = false,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  }
}

function chooseRecurringDelete(onOne: () => void, onFuture: () => void) {
  const { entry } = strings;
  if (Platform.OS === 'web') {
    if (window.confirm(`${entry.deleteRecurringTitle}\n${entry.deleteThisAndFuture}?`)) {
      onFuture();
    } else if (window.confirm(`${entry.deleteRecurringTitle}\n${entry.deleteOnlyThis}?`)) {
      onOne();
    }
    return;
  }
  Alert.alert(entry.deleteRecurringTitle, entry.deleteRecurringMessage, [
    { text: strings.common.cancel, style: 'cancel' },
    { text: entry.deleteOnlyThis, style: 'destructive', onPress: onOne },
    { text: entry.deleteThisAndFuture, style: 'destructive', onPress: onFuture },
  ]);
}

/**
 * Same shape as `chooseRecurringDelete` — asked only when saving edits to a
 * still-repeating occurrence, where "just this one" and "this and future" are
 * both coherent readings of what the user typed (see `handleSubmit`'s call
 * site for the exact trigger condition). Not destructive, so unlike delete's
 * red buttons these use the default style.
 */
function chooseRecurringSave(onOne: () => void, onFuture: () => void) {
  const { entry } = strings;
  if (Platform.OS === 'web') {
    if (window.confirm(`${entry.saveRecurringTitle}\n${entry.saveThisAndFuture}?`)) {
      onFuture();
    } else if (window.confirm(`${entry.saveRecurringTitle}\n${entry.saveOnlyThis}?`)) {
      onOne();
    }
    return;
  }
  Alert.alert(entry.saveRecurringTitle, entry.saveRecurringMessage, [
    { text: strings.common.cancel, style: 'cancel' },
    { text: entry.saveOnlyThis, style: 'default', onPress: onOne },
    { text: entry.saveThisAndFuture, style: 'default', onPress: onFuture },
  ]);
}

// How far the incoming tab body travels (px) and how long that takes (ms).
// Originally this used reanimated's built-in `FadeInLeft`/`FadeInRight`
// (`.duration(durations.base)`), which on web renders as a fixed 25px CSS
// keyframe — not adjustable independent of duration. Measured directly
// (sampling computed transform/opacity every animation frame, not just
// screenshots): it peaked at only ~17% of the screen changing and was fully
// settled by ~160ms, which reads as a flicker rather than a slide on a
// mostly-static frame (tab bar and background never move). This is a
// hand-rolled replacement — the same useSharedValue/useAnimatedStyle pattern
// CalendarScreen's title block already proves out — so the distance is a
// number we control. 36px rather than the title's 12px: this swaps the whole
// screen, a bigger event than a label changing, and needs more travel to
// register against that much more static chrome around it. The duration is a
// touch longer than `durations.base` for the same reason.
const TAB_TRAVEL = 36;
const TAB_TRANSITION_DURATION = 280;

/**
 * Wraps the active tab's screen and slides it in from the direction the user
 * moved along the bar. Mounted fresh per tab (the parent keys it on `tab`), so
 * the entrance is a plain mount-effect rather than reanimated's `entering`
 * animation-builder machinery — nothing here needs to interrupt or reverse.
 */
function TabTransition({
  forward,
  style,
  children,
}: {
  forward: boolean;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { enabled } = useMotion();
  const translateX = useSharedValue(enabled ? (forward ? TAB_TRAVEL : -TAB_TRAVEL) : 0);
  const opacity = useSharedValue(enabled ? 0 : 1);

  useEffect(() => {
    if (!enabled) return;
    translateX.value = withAppTiming(0, {
      duration: TAB_TRANSITION_DURATION,
      easing: easings.standard,
    });
    opacity.value = withAppTiming(1, {
      duration: TAB_TRANSITION_DURATION,
      easing: easings.standard,
    });
    // Runs once, on this mount — the parent already remounts this component
    // per tab switch (`key={tab}`), so there is no second "which tab" input to
    // react to here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export function Root(props: RootProps) {
  return (
    <AppShell>
      <Shell {...props} />
    </AppShell>
  );
}

function Shell({
  state,
  update,
  showCorruptNotice,
  hasCorruptStash,
  readCorruptStash,
  persistenceNotice = null,
}: RootProps) {
  const [tab, setTab] = useState<Tab>('calendar');
  const [sheet, setSheet] = useState<Sheet>(null);
  const { enabled: motionEnabled } = useMotion();
  // Which day just received a saved entry, and a bump counter so two saves onto
  // the *same* day still each play the landing pulse. The Calendar screen
  // forwards this to the matching day cell; nothing else reads it.
  const [savedPulse, setSavedPulse] = useState<{ day: number; nonce: number }>({
    day: 0,
    nonce: 0,
  });
  // Fires the pulse after the sheet's own dismiss animation clears the screen
  // (see `handleSubmit`) rather than the instant a save happens. Dropped on
  // unmount so a save right before navigating away can't set state on a torn
  // down tree.
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pulseTimer.current !== null) clearTimeout(pulseTimer.current);
    },
    [],
  );
  // Tab order, so a switch can animate in the direction the user travelled
  // along the bar rather than always arriving from the same side.
  const previousTab = useRef<Tab>(tab);
  const forward = tab === 'summary' && previousTab.current === 'calendar';
  previousTab.current = tab;
  // Which entry the Entry sheet is editing (#43); null = create mode.
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [entryContentHeight, setEntryContentHeight] = useState(0);

  // Calendar cursor. Month navigation lands in slice #4; for now it tracks the
  // real current month, with the selected day defaulting to today.
  const today = useToday();
  const todayDate = useMemo(
    () => ({ y: today.getFullYear(), m: today.getMonth(), day: today.getDate() }),
    [today],
  );
  const [cursor, setCursor] = useState<YM>({ y: today.getFullYear(), m: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const symbol = state.currency.symbol;
  const ledger = { entries: state.entries, recurrenceRules: state.recurrenceRules };
  const activeRepeats = useMemo(
    () => activeRecurrences(state.recurrenceRules, todayDate),
    [state.recurrenceRules, todayDate],
  );
  // Keep the pager's neighboring months populated during a swipe. Screens still
  // filter this finite projection to their requested cursor month.
  const visibleEntries = useMemo(
    () =>
      [-1, 0, 1].flatMap((offset) =>
        entriesForMonth(ledger, shiftMonth(cursor, offset)),
      ),
    [state.entries, state.recurrenceRules, cursor.y, cursor.m],
  );

  // One-time boot notice (#28): fires once per corrupt boot, off
  // `showCorruptNotice` (this session's load result), never off
  // `hasCorruptStash` (which stays true across later, healthy boots too).
  useEffect(() => {
    if (showCorruptNotice) {
      notify(strings.corruptNotice.title, strings.corruptNotice.message);
    }
  }, [showCorruptNotice]);

  useEffect(() => {
    if (persistenceNotice === 'read-failed') {
      notify(strings.persistenceNotice.readFailedTitle, strings.persistenceNotice.readFailedMessage);
    } else if (persistenceNotice === 'recovery-failed') {
      notify(
        strings.persistenceNotice.recoveryFailedTitle,
        strings.persistenceNotice.recoveryFailedMessage,
      );
    } else if (persistenceNotice === 'save-failed') {
      notify(strings.persistenceNotice.saveFailedTitle, strings.persistenceNotice.saveFailedMessage);
    }
  }, [persistenceNotice]);

  // Single-sheet-host handlers (#60): the unified sheet host replaces the
  // three separate modals. Sheet state is authoritative; dismissal while a sheet
  // is still requested gets reconciled by re-presenting.
  const closeSheet = () => setSheet(null);

  const openSettings = () => setSheet('settings');
  const openRepeats = () => setSheet('repeats');
  const openBudgets = () => setSheet('budgets');
  const backToSettings = () => setSheet('settings');

  // openEntry(): the ＋ button — always create mode (clear any prior editing).
  const openEntry = () => {
    setEditing(null);
    setEntryContentHeight(0);
    setSheet('entry');
  };

  // openEdit(): tap a day-list row → edit that entry. Re-select its day so the
  // Calendar returns to it after save/delete.
  const openEdit = (entry: Transaction) => {
    setEditing(entry);
    setEntryContentHeight(0);
    setSelectedDay(entry.day);
    setSheet('entry');
  };

  const openRepeatEdit = (entry: Transaction) => {
    setEditing(entry);
    setEntryContentHeight(0);
    setSheet('repeat-entry');
  };

  // exportData(): serialize the full ledger to a Zaim-format CSV and hand it
  // to the share sheet. Restore is the existing "Import from Zaim" row below —
  // an exported file round-trips through it unchanged, so no new import UI.
  const exportData = async () => {
    try {
      const now = new Date();
      const entries = entriesThrough(ledger, {
        y: now.getFullYear(),
        m: now.getMonth(),
        day: now.getDate(),
      });
      await shareTextFile('kaji-export.csv', serializeZaimCsv(entries));
    } catch {
      notify(strings.zaim.exportFailedTitle, strings.zaim.exportFailedMessage);
    }
  };

  // exportCorruptStash(): share the raw unreadable blob kept by the #28 safety
  // net, so a stuck user can get their pre-corruption data off the device.
  const exportCorruptStash = async () => {
    try {
      const raw = await readCorruptStash();
      if (raw) await shareTextFile('kaji-unreadable-backup.txt', raw);
    } catch {
      notify(strings.zaim.exportFailedTitle, strings.zaim.exportFailedMessage);
    }
  };

  // importZaim(): pick a Zaim CSV export → decode (Shift-JIS or UTF-8) →
  // parse against the current ledger (so re-importing an overlapping export
  // skips rows already present) → native Import/Cancel confirmation with the
  // entry count and skip-reason breakdown → merge entries and any new
  // categories into the ledger through the normal update() path. Canceling
  // the picker or the confirmation writes nothing.
  const importZaim = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      const buffer =
        Platform.OS === 'web'
          ? await asset.file!.arrayBuffer()
          : await new File(asset.uri).arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const text = decodeZaimBytes(bytes);
      if (!text) {
        notify(strings.zaim.notZaimTitle, strings.zaim.notZaimMessage);
        return;
      }

      const now = new Date();
      const today = {
        y: now.getFullYear(),
        m: now.getMonth(),
        day: now.getDate(),
      };
      const recurringHistory = entriesThrough(
        { entries: [], recurrenceRules: state.recurrenceRules },
        today,
      );
      const result = parseZaimCsv(text, {
        expCats: state.expCats,
        incCats: state.incCats,
        // All persisted one-time entries participate in duplicate detection,
        // including future-dated rows. Infinite rules contribute only their
        // finite concrete history through today.
        entries: [...state.entries, ...recurringHistory],
      });
      if (result.entries.length === 0) {
        notify(
          strings.zaim.noEntriesTitle,
          `${strings.zaim.noEntriesMessage}${skipSummary(result.skipped)}`,
        );
        return;
      }

      const message = `${strings.zaim.entriesReady(result.entries.length)}${skipSummary(result.skipped)}`;
      confirm(strings.settings.importFromZaim, message, () => {
        update({
          entries: [...state.entries, ...result.entries],
          expCats: result.expCats,
          incCats: result.incCats,
        });
        setSheet(null);
      });
    } catch {
      notify(strings.zaim.importFailedTitle, strings.zaim.importFailedMessage);
      return;
    }
  };

  // Month navigation: move the cursor and clamp the selected day into the new
  // month (e.g. Jan 31 → Feb 28) so the selection stays valid. `setMonth` takes
  // the absolute month (the pager settle can land several months away after
  // rapid flings, #48); the ‹ › chevrons shift by one via `goMonth`.
  const setMonth = (next: YM) => {
    setCursor(next);
    setSelectedDay((d) => clampDay(d, next.y, next.m));
  };
  const goMonth = (delta: number) => setMonth(shiftMonth(cursor, delta));

  // handleSubmit(): persist a one-time entry or recurrence rule. Editing a
  // projected occurrence splits its rule so past history remains unchanged —
  // `commit` does the actual persistence once a scope is settled; the check
  // below decides whether that scope needs asking for at all.
  const handleSubmit = (draft: EntryDraft, weekendShift: WeekendShift) => {
    const commit = (scope: 'one' | 'future') => {
      const next = saveLedgerItem(ledger, draft, weekendShift, editing ?? undefined, scope);
      if (next === ledger) return;
      entrySaved();
      update({
        ...next,
        ...(draft.type === 'expense'
          ? { expCats: promoteCategory(state.expCats, draft.category) }
          : { incCats: promoteCategory(state.incCats, draft.category) }),
      });
      if (sheet === 'repeat-entry') {
        setSheet('repeats');
        return;
      }
      let landing = { y: draft.y, m: draft.m, day: draft.day };
      // A `scope: 'one'` save doesn't necessarily land on `draft`'s own date:
      // the domain layer redirects an untouched date field from the rule's
      // raw scheduled anchor to the occurrence's weekend-shifted *displayed*
      // date instead (see `saveLedgerItem`'s "dateFieldUntouched" comment) —
      // otherwise a Saturday-anchored occurrence edited without touching the
      // date would silently save under the Saturday, while the user found
      // and opened it on the Monday it actually displays on. Reading the
      // landing date back off the entry that was actually inserted, rather
      // than recomputing that redirect a second time here, is what keeps the
      // two from being able to drift out of sync with each other.
      if (scope === 'one') {
        const created = next.entries.find(
          (candidate) => !ledger.entries.some((old) => old.id === candidate.id),
        );
        if (created) landing = { y: created.y, m: created.m, day: created.day };
      } else if (draft.repeat && draft.repeat !== 'never') {
        const newRules = next.recurrenceRules.filter(
          (rule) => !state.recurrenceRules.some((old) => old.id === rule.id),
        );
        const created = [-1, 0, 1]
          .flatMap((offset) =>
            entriesForMonth(next, shiftMonth({ y: draft.y, m: draft.m }, offset)),
          )
          .find((entry) => {
            if (!entry.occurrence) return false;
            const rule = newRules.find((candidate) => candidate.id === entry.occurrence!.ruleId);
            return (
              rule !== undefined &&
              entry.occurrence.scheduled.y === rule.start.y &&
              entry.occurrence.scheduled.m === rule.start.m &&
              entry.occurrence.scheduled.day === rule.start.day
            );
          });
        if (created) landing = { y: created.y, m: created.m, day: created.day };
      }
      setCursor({ y: landing.y, m: landing.m });
      setSelectedDay(landing.day);
      setTab('calendar');
      closeSheet();

      // Mark the destination so the Calendar plays a landing pulse on that cell.
      // This is the second half of the save gesture: the Entry sheet's bloom says
      // "saved", and this says *where*. Fired for edits too — an edited entry can
      // move to a different day, and the pulse is how the user finds it again.
      //
      // Deliberately deferred to land once the sheet has actually cleared the
      // screen, not the instant the save happens: firing immediately (as this
      // used to) raced the sheet's own `SHEET_ANIMATION_DURATION` dismiss, so the
      // pulse played out on the day cell while the closing sheet was still
      // covering it — verified directly by sampling the cell's computed style on
      // every animation frame, which showed the pulse essentially finished before
      // the sheet had slid away. Motion-off skips the wait: `DayCell` no-ops the
      // pulse either way, so there is nothing to time against.
      const fireLandingPulse = () =>
        setSavedPulse((prev) => ({ day: landing.day, nonce: prev.nonce + 1 }));
      if (motionEnabled) {
        if (pulseTimer.current !== null) clearTimeout(pulseTimer.current);
        pulseTimer.current = setTimeout(() => {
          pulseTimer.current = null;
          fireLandingPulse();
        }, SHEET_ANIMATION_DURATION);
      } else {
        fireLandingPulse();
      }
    };

    // Editing a specific occurrence of a still-repeating series is ambiguous
    // — should the new values apply just here, or from here on? Ask, the same
    // way `handleDelete` asks via `chooseRecurringDelete`. Not asked when:
    // repeat-entry management (Settings → Repeats edits the series itself —
    // "just this once" doesn't fit there, matching how that same screen's
    // delete is a plain "Stop repeat" with no scope choice either); or the
    // edit sets Repeat to Never, since ending a series has no "just this
    // occurrence" reading — it can only mean "and future".
    if (sheet !== 'repeat-entry' && editing?.occurrence && draft.repeat && draft.repeat !== 'never') {
      chooseRecurringSave(
        () => commit('one'),
        () => commit('future'),
      );
      return;
    }
    commit('future');
  };

  // handleDelete(): one-time entries use the existing destructive confirm;
  // recurring occurrences offer delete-only-this and this-and-future scopes.
  const handleDelete = (entry: Transaction) => {
    if (sheet === 'repeat-entry') {
      confirm(
        strings.repeats.stopConfirmTitle,
        strings.repeats.stopConfirmMessage,
        () => {
          update(deleteLedgerItem(ledger, entry, 'future'));
          setSheet('repeats');
        },
        strings.repeats.stopRepeat,
        true,
      );
      return;
    }
    const remove = (scope: 'one' | 'future') => {
      update(deleteLedgerItem(ledger, entry, scope));
      setSelectedDay(entry.day);
      setTab('calendar');
      closeSheet();
    };
    if (entry.occurrence) {
      chooseRecurringDelete(() => remove('one'), () => remove('future'));
      return;
    }
    confirm(
      strings.entry.deleteConfirmTitle,
      strings.entry.deleteConfirmMessage,
      () => remove('one'),
      strings.common.delete,
      true,
    );
  };

  // deleteAllData(): wipe entries and budgets (#67), preserving categories,
  // currency, theme, lock, and open-to preference; guarded by destructive
  // confirm (web window.confirm fallback).
  const deleteAllData = () => {
    confirm(
      strings.settings.deleteAllData,
      strings.settings.deleteAllDataConfirmMessage,
      () => {
        update({ entries: [], recurrenceRules: [], budgets: {}, totalBudget: 0 });
        closeSheet();
      },
      strings.common.delete,
      true,
    );
  };

  return (
    <View style={styles.flex}>
      {/* Keyed on `tab` so switching tabs remounts the body and replays the
          entrance. Only the active screen is ever mounted — a true cross-fade
          would hold both the month grid and the Summary aggregation live for
          the length of the transition, which is real work on a low-end phone
          for a quarter-second of overlap nobody asked for. The incoming screen
          drifts in from the side of the bar the user moved toward, so the
          direction of travel is legible even though the outgoing screen is
          simply gone. See `TabTransition` for why this is hand-rolled rather
          than reanimated's `entering` presets. */}
      <TabTransition key={tab} forward={forward} style={styles.body}>
        {tab === 'calendar' ? (
          <CalendarScreen
            entries={visibleEntries}
            budgets={state.budgets}
            budgetMode={state.budgetMode}
            totalBudget={state.totalBudget}
            y={cursor.y}
            m={cursor.m}
            day={selectedDay}
            today={todayDate}
            symbol={symbol}
            view={state.calendarView}
            onToggleView={() =>
              update({ calendarView: state.calendarView === 'dots' ? 'numbers' : 'dots' })
            }
            onSelectDay={setSelectedDay}
            onEditEntry={openEdit}
            onDeleteEntry={handleDelete}
            onPrevMonth={() => goMonth(-1)}
            onNextMonth={() => goMonth(1)}
            onMonthChange={setMonth}
            onSettings={openSettings}
            pulseDay={savedPulse.day}
            pulseNonce={savedPulse.nonce}
          />
        ) : (
          <SummaryScreen
            entries={visibleEntries}
            budgets={state.budgets}
            budgetMode={state.budgetMode}
            totalBudget={state.totalBudget}
            y={cursor.y}
            m={cursor.m}
            symbol={symbol}
            onSettings={openSettings}
          />
        )}
      </TabTransition>

      <TabBar tab={tab} onSelect={setTab} onAdd={openEntry} />

      {/* Unified sheet host (#60): single BottomSheetModal for entry/settings/budgets.
          The sheet state selects which body renders. Transitions between non-null
          values are content swaps inside the open sheet; only null→sheet and
          sheet→null trigger present/dismiss. Sheet bodies mount unconditionally. */}
      <BottomSheet
        visible={sheet !== null}
        onClose={sheet === 'repeat-entry' ? openRepeats : closeSheet}
        defaultHeightRatio={sheet === 'entry' || sheet === 'repeat-entry' ? 0.83 : 0.8}
        contentHeight={sheet === 'entry' || sheet === 'repeat-entry' ? entryContentHeight : 0}
        testID={sheet ? `${sheet}-sheet` : undefined}
      >
        {(sheet === 'entry' || sheet === 'repeat-entry') && (
          <EntrySheet
            expCats={state.expCats}
            incCats={state.incCats}
            y={cursor.y}
            m={cursor.m}
            day={selectedDay}
            today={todayDate}
            symbol={symbol}
            editing={editing ?? undefined}
            repeatManagement={sheet === 'repeat-entry'}
            onSave={handleSubmit}
            onDelete={handleDelete}
            onClose={sheet === 'repeat-entry' ? openRepeats : closeSheet}
            onContentHeightChange={setEntryContentHeight}
            ScrollContainer={BottomSheetScrollView}
          />
        )}
        {sheet === 'settings' && (
          <SettingsSheet
            currency={state.currency}
            expCats={state.expCats}
            incCats={state.incCats}
            onChangeCurrency={(currency: Currency) => update({ currency })}
            onChangeExpCats={(expCats) =>
              update({ expCats, budgets: pruneBudgets(state.budgets, expCats) })
            }
            onChangeIncCats={(incCats) => update({ incCats })}
            activeRepeatCount={activeRepeats.length}
            onOpenRepeats={openRepeats}
            onOpenBudgets={openBudgets}
            onExportData={exportData}
            onImportZaim={importZaim}
            hasCorruptStash={hasCorruptStash}
            onExportCorruptStash={exportCorruptStash}
            onDeleteAllData={deleteAllData}
            onClose={closeSheet}
            ScrollContainer={BottomSheetScrollView}
          />
        )}
        {sheet === 'budgets' && (
          <BudgetsSheet
            expCats={state.expCats}
            budgets={state.budgets}
            budgetMode={state.budgetMode}
            totalBudget={state.totalBudget}
            symbol={symbol}
            onChangeBudgets={(budgets) => update({ budgets })}
            onChangeBudgetMode={(budgetMode) => update({ budgetMode })}
            onChangeTotalBudget={(totalBudget) => update({ totalBudget })}
            onDone={backToSettings}
            ScrollContainer={BottomSheetScrollView}
          />
        )}
        {sheet === 'repeats' && (
          <RepeatsSheet
            recurrenceRules={state.recurrenceRules}
            today={todayDate}
            symbol={symbol}
            onEdit={openRepeatEdit}
            onDone={backToSettings}
            ScrollContainer={BottomSheetScrollView}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Native SafeAreaView (AppShell) insets the top; web has no safe area, so add
  // the design's status offset there to keep content off the container edge.
  body: { flex: 1, paddingTop: Platform.OS === 'web' ? metrics.statusOffset : 0 },
});
