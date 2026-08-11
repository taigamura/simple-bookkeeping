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
  categoryEntities,
  categoryIdFor,
  clampDay,
  decodeZaimBytes,
  deleteLedgerItem,
  entriesForMonth,
  entriesThrough,
  parseZaimCsv,
  periodMonths,
  promoteCategory,
  pruneBudgets,
  saveLedgerItem,
  shiftPeriod,
  serializeZaimCsv,
  shiftMonth,
  type Currency,
  type EntryDraft,
  type Transaction,
  type WeekendShift,
  type YM,
  type ZaimSkipTally,
  householdSyncStatus,
  createHouseholdBackup,
  previewHouseholdBackup,
  restoreHouseholdBackup,
  createSyncState,
  type HouseholdBackupPayload,
  type HouseholdBackupStore,
  type SyncHistoryRow,
  type SyncStatusModel,
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
import { HouseholdSyncSheet } from '../screens/HouseholdSyncSheet';
import { SummaryScreen } from '../screens/SummaryScreen';
import type { AppState, UseStore } from '../store';
import { easings, metrics, useMotion, useTheme, withAppDelay, withAppTiming } from '../theme';
import { SaveWave } from '../ui';
import { AppShell } from './AppShell';
import { BottomSheet, SHEET_ANIMATION_DURATION } from './BottomSheet';
import { TabBar } from './TabBar';
import type { Sheet, Tab } from './types';

interface RootProps {
  state: AppState;
  /** Resolves true only after the patch is durably persisted. */
  update: (patch: Partial<AppState>) => Promise<boolean> | void;
  /** True for this session if boot's load() stashed an unreadable blob (#28). */
  showCorruptNotice: boolean;
  /** Whether a corrupt-stash blob exists — gates the Settings recovery row. */
  hasCorruptStash: boolean;
  readCorruptStash: () => Promise<string | null>;
  persistenceNotice?: UseStore['persistenceNotice'];
  quickEntryDraft?: EntryDraft | null;
  quickEntryPresentationToken?: number;
  onQuickEntryDraftDisposition?: (draft: EntryDraft, token: number) => void;
  /** Runtime-owned nearby state. Defaults to a truthful unpaired/offline surface. */
  householdSync?: {
    model: SyncStatusModel;
    history: SyncHistoryRow[];
    onSyncNow: () => void;
    onRestore: (transactionId: string, operationId: string) => void;
  };
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
  if (skipped.invalidDate > 0) parts.push(skip.invalidDate(skipped.invalidDate));
  if (skipped.invalidAmount > 0) parts.push(skip.invalidAmount(skipped.invalidAmount));
  if (skipped.emptyCategory > 0) parts.push(skip.emptyCategory(skipped.emptyCategory));
  if (skipped.unsupportedType > 0) parts.push(skip.unsupportedType(skipped.unsupportedType));
  if (skipped.outOfRange > 0) parts.push(skip.outOfRange(skipped.outOfRange));
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

// How far a tab body travels (px) and how long the swap takes (ms).
//
// This started as reanimated's built-in `FadeInLeft`/`FadeInRight`, which on
// web renders as a fixed 25px CSS keyframe — not adjustable independent of
// duration. That was replaced by a hand-rolled entrance (36px / 280ms /
// `easings.standard`) so the distance was a number we controlled. It still
// read as a jump on device, for two reasons that the entrance alone could not
// fix:
//
//  1. **There was no exit.** Only the active screen was ever mounted, so the
//     outgoing screen vanished on the first frame of the swap. An entrance
//     with no matching exit is a hard cut followed by an arrival, which is
//     exactly what "jumps in" describes. The old comment justified this on
//     low-end-phone grounds — holding the month grid and the Summary
//     aggregation live at once for a quarter-second. That trade was called
//     wrong: both screens are cheap projections over an already-computed
//     `visibleEntries`, and the cut is visible on every single tab press.
//  2. **`easings.standard` is an ease-out expo**, which covers ~85% of its
//     distance in the first third. Right for a label; at screen scale it means
//     the incoming body is in place before the eye registers that it moved.
//     See `easings.screen`, added for this.
//
// So the swap is now a shared-axis transition: the outgoing screen accelerates
// away along the axis and fades, the incoming one decelerates in behind it,
// overlapping in the middle. `TAB_ENTER_FADE_DELAY` holds the incoming screen's
// opacity at 0 while the outgoing one clears, so the two never both sit at half
// opacity over the background — that cross-dissolve is what makes a shared-axis
// swap read as muddy rather than as one thing replacing another.
const TAB_TRAVEL = 40;
const TAB_TRANSITION_DURATION = 320;
const TAB_ENTER_FADE_DELAY = 90;
const TAB_EXIT_FADE_DURATION = 150;

/** Which way the body travels: `forward` is calendar → summary along the bar. */
type TabPhase = 'entering' | 'exiting';

/**
 * One tab's screen, animated along the shared axis. Rendered with a stable
 * `key` per tab so its instance survives the swap — that is what lets `phase`
 * flip on a *mounted* layer (`entering` → `exiting`, and back again if the user
 * taps the other tab mid-transition) instead of relying on mount/unmount, which
 * cannot express an exit for a screen that is being removed from the tree.
 *
 * The shared values are read once for the initial phase and then driven by the
 * effect; an interrupted swap simply retargets them from wherever they are, so
 * a reversal picks up mid-flight rather than snapping to a start position.
 */
function TabLayer({
  phase,
  forward,
  children,
}: {
  phase: TabPhase;
  forward: boolean;
  children: React.ReactNode;
}) {
  const { enabled } = useMotion();
  const enterFrom = forward ? TAB_TRAVEL : -TAB_TRAVEL;
  const exitTo = forward ? -TAB_TRAVEL : TAB_TRAVEL;
  const translateX = useSharedValue(enabled && phase === 'entering' ? enterFrom : 0);
  const opacity = useSharedValue(enabled && phase === 'entering' ? 0 : 1);

  useEffect(() => {
    if (!enabled) {
      translateX.value = 0;
      opacity.value = phase === 'entering' ? 1 : 0;
      return;
    }
    if (phase === 'entering') {
      translateX.value = withAppTiming(0, {
        duration: TAB_TRANSITION_DURATION,
        easing: easings.screen,
      });
      opacity.value = withAppDelay(
        TAB_ENTER_FADE_DELAY,
        withAppTiming(1, {
          duration: TAB_TRANSITION_DURATION - TAB_ENTER_FADE_DELAY,
          easing: easings.screen,
        }),
      );
    } else {
      // Exits accelerate away (`easings.exit`), and the fade finishes well
      // before the travel does, so the outgoing screen is gone from view while
      // still visibly moving — it reads as leaving, not as dissolving in place.
      translateX.value = withAppTiming(exitTo, {
        duration: TAB_TRANSITION_DURATION,
        easing: easings.exit,
      });
      opacity.value = withAppTiming(0, {
        duration: TAB_EXIT_FADE_DURATION,
        easing: easings.exit,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, enabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, animatedStyle]}
      // The outgoing layer is still on screen for the length of the swap; it
      // must not eat taps aimed at the screen arriving underneath it.
      pointerEvents={phase === 'entering' ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Hosts both tab bodies during a swap. Keeps the previous tab mounted for
 * `TAB_TRANSITION_DURATION` so it has something to animate out, then drops it.
 *
 * `outgoing` is derived during render rather than in an effect: an effect runs
 * after commit, so the frame on which `tab` changes would paint with the old
 * screen already unmounted and the new one not yet faded in — reintroducing the
 * exact cut this replaced, for one frame. Setting state during render of the
 * same component re-renders before paint, which is what keeps the handoff
 * seamless.
 */
function TabSwitcher({
  tab,
  style,
  render,
}: {
  tab: Tab;
  style: StyleProp<ViewStyle>;
  render: (tab: Tab) => React.ReactNode;
}) {
  const { enabled } = useMotion();
  const [outgoing, setOutgoing] = useState<Tab | null>(null);
  // `forward` is the direction of the *current* swap, shared by both layers so
  // they travel along the same axis rather than toward each other.
  const [forward, setForward] = useState(true);
  const shown = useRef(tab);

  if (shown.current !== tab) {
    setForward(tab === 'summary');
    setOutgoing(enabled ? shown.current : null);
    shown.current = tab;
  }

  useEffect(() => {
    if (outgoing === null) return;
    const timer = setTimeout(() => setOutgoing(null), TAB_TRANSITION_DURATION);
    return () => clearTimeout(timer);
  }, [outgoing]);

  return (
    <View style={style}>
      {outgoing !== null && outgoing !== tab && (
        <TabLayer key={outgoing} phase="exiting" forward={forward}>
          {render(outgoing)}
        </TabLayer>
      )}
      <TabLayer key={tab} phase="entering" forward={forward}>
        {render(tab)}
      </TabLayer>
    </View>
  );
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
  quickEntryDraft = null,
  quickEntryPresentationToken = 0,
  onQuickEntryDraftDisposition,
  householdSync = {
    model: householdSyncStatus({ paired: false, foreground: true, partnerPresent: false, queuedOperationCount: 0 }),
    history: [],
    onSyncNow: () => {},
    onRestore: () => {},
  },
}: RootProps) {
  const [tab, setTab] = useState<Tab>('calendar');
  const [sheet, setSheet] = useState<Sheet>(null);
  const { enabled: motionEnabled } = useMotion();
  const { colors } = useTheme();
  // Which day just received a saved entry, and a bump counter so two saves onto
  // the *same* day still each play the landing pulse. The Calendar screen
  // forwards this to the matching day cell; nothing else reads it.
  const [savedPulse, setSavedPulse] = useState<{ day: number; nonce: number }>({
    day: 0,
    nonce: 0,
  });
  const [saveWaveNonce, setSaveWaveNonce] = useState(0);
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
  // Which entry the Entry sheet is editing (#43); null = create mode.
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [activeQuickEntryDraft, setActiveQuickEntryDraft] = useState<EntryDraft | null>(null);
  const activeQuickEntryToken = quickEntryPresentationToken;
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
  // Summary pages by *period*, which is a year wide in annual mode, so it needs
  // a wider projection than the Calendar's ±1 month — 36 months of it when
  // annual, to cover the neighbour years its pager can settle on. Recurrence
  // rules are infinite and only ever materialise on demand, so this has to be
  // asked for explicitly rather than falling out of the ledger. Kept separate
  // from `visibleEntries` (rather than widening that) so the Calendar's month
  // grid never pays for a projection it does not read.
  const summaryEntries = useMemo(
    () =>
      [-1, 0, 1]
        .flatMap((offset) =>
          periodMonths(
            shiftPeriod(cursor, offset, state.summaryGranularity),
            state.summaryGranularity,
          ),
        )
        .flatMap((month) => entriesForMonth(ledger, month)),
    [state.entries, state.recurrenceRules, cursor.y, cursor.m, state.summaryGranularity],
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
    } else if (persistenceNotice === 'quick-entry-cache-failed') {
      notify('Quick entry unavailable', 'Your ledger save succeeded, but the quick-entry cache could not be updated. Retry when the shared container is available.');
    }
  }, [persistenceNotice]);

  useEffect(() => {
    if (!quickEntryDraft) return;
    setActiveQuickEntryDraft(quickEntryDraft);
    setEditing(null);
    setEntryContentHeight(0);
    setSheet('entry');
  }, [quickEntryDraft, quickEntryPresentationToken]);

  const disposeQuickEntry = () => {
    if (!activeQuickEntryDraft || !quickEntryDraft) return false;
    const draft = activeQuickEntryDraft;
    setActiveQuickEntryDraft(null);
    setSheet(null);
    onQuickEntryDraftDisposition?.(draft, activeQuickEntryToken);
    return true;
  };

  // Single-sheet-host handlers (#60): the unified sheet host replaces the
  // three separate modals. Sheet state is authoritative; dismissal while a sheet
  // is still requested gets reconciled by re-presenting.
  const closeSheet = () => {
    if (sheet === 'entry' && disposeQuickEntry()) return;
    setSheet(null);
  };

  const openSettings = () => setSheet('settings');
  const openRepeats = () => setSheet('repeats');
  const openBudgets = () => setSheet('budgets');
  const openHouseholdSync = () => setSheet('household-sync');
  const backToSettings = () => setSheet('settings');

  // openEntry(): the ＋ button — always create mode (clear any prior editing).
  const openEntry = () => {
    if (activeQuickEntryDraft) return;
    setActiveQuickEntryDraft(null);
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

  // Local household backup is deliberately separate from the portable CSV.
  // This app currently has one local household projection, so its identity is
  // loaded from the same checkpoint used by restore rather than accepted from
  // the picker/caller. No device preferences or pairing key material enter it.
  const householdBackupPayload = (): HouseholdBackupPayload => ({
    household: state.household,
    sync: createSyncState('local-household', state.household.entries),
  });
  const householdBackupStore: HouseholdBackupStore = {
    load: async () => householdBackupPayload(),
    save: async (payload) => {
      const saved = await update({
        entries: payload.household.entries,
        recurrenceRules: payload.household.recurrenceRules,
        expCats: payload.household.categories.filter((category) => category.type === 'expense').map((category) => category.label),
        incCats: payload.household.categories.filter((category) => category.type === 'income').map((category) => category.label),
        budgets: payload.household.budgets,
        currency: payload.household.currency,
        household: payload.household,
      });
      if (saved === false) throw new Error('backup restore save failed');
    },
  };
  const exportHouseholdBackup = async () => {
    try {
      await shareTextFile('kaji-household-backup.json', createHouseholdBackup(householdBackupPayload()));
    } catch {
      notify(strings.zaim.exportFailedTitle, strings.zaim.exportFailedMessage);
    }
  };
  const importHouseholdBackup = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const text = Platform.OS === 'web' ? await asset.file!.text() : await new File(asset.uri).text();
      const preview = previewHouseholdBackup(text);
      confirm(
        strings.settings.importHouseholdBackup,
        `${preview.entries} entries, ${preview.recurrenceRules} repeating rules, ${preview.categories} categories, and ${preview.budgets} budgets will replace this household.`,
        () => {
          void restoreHouseholdBackup(householdBackupStore, text, { confirm: true }).catch(() => {
            notify(strings.zaim.importFailedTitle, strings.zaim.importFailedMessage);
          });
        },
        strings.common.import,
      );
    } catch {
      notify(strings.zaim.importFailedTitle, strings.zaim.importFailedMessage);
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
  const handleSubmit = async (draft: EntryDraft, weekendShift: WeekendShift): Promise<boolean> => {
    const categories = categoryEntities(state.expCats, state.incCats, state.household.categories);
    const identityDraft: EntryDraft = {
      ...draft,
      categoryId: categoryIdFor(draft.category, draft.type, categories),
    };
    const commit = async (scope: 'one' | 'future'): Promise<boolean> => {
      const next = saveLedgerItem(ledger, identityDraft, weekendShift, editing ?? undefined, scope);
      if (next === ledger) return false;
      const persisted = update({
        ...next,
        ...(draft.type === 'expense'
          ? { expCats: promoteCategory(state.expCats, draft.category) }
          : { incCats: promoteCategory(state.incCats, draft.category) }),
      });
      if (persisted !== undefined && !(await persisted)) return false;

      entrySaved();
      setSaveWaveNonce((nonce) => nonce + 1);
      if (sheet === 'repeat-entry') {
        setSheet('repeats');
        return true;
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
      return true;
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
      chooseRecurringSave(() => void commit('one'), () => void commit('future'));
      return false;
    }
    return commit('future');
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

  // renderTab(): one tab's body. Called by `TabSwitcher` for both the entering
  // and the exiting layer during a swap, which is why it is a function of the
  // tab rather than a conditional inline in the tree.
  const renderTab = (which: Tab) =>
    which === 'calendar' ? (
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
        entries={summaryEntries}
        budgets={state.budgets}
        budgetMode={state.budgetMode}
        totalBudget={state.totalBudget}
        y={cursor.y}
        m={cursor.m}
        symbol={symbol}
        granularity={state.summaryGranularity}
        onChangeGranularity={(summaryGranularity) => update({ summaryGranularity })}
        onPeriodChange={setMonth}
        onSettings={openSettings}
      />
    );

  return (
    <View style={styles.flex}>
      {/* Both tab bodies are mounted for the length of a swap so the outgoing
          one has something to animate out — see `TabSwitcher`/`TabLayer`. Each
          body is rendered on demand from `renderTab`, so the layer that is on
          its way out keeps receiving fresh props (a save that lands on the
          Calendar while Summary is exiting still shows the right figures). */}
      <TabSwitcher tab={tab} style={styles.body} render={renderTab} />

      <TabBar tab={tab} onSelect={setTab} onAdd={openEntry} />

      {/* Unified sheet host (#60): single BottomSheetModal for entry/settings/budgets.
          The sheet state selects which body renders. Transitions between non-null
          values are content swaps inside the open sheet; only null→sheet and
          sheet→null trigger present/dismiss. Sheet bodies mount unconditionally. */}
      <BottomSheet
        visible={sheet !== null}
        onClose={sheet === 'repeat-entry' ? openRepeats : closeSheet}
        enableContentPanningGesture={sheet === 'entry' || sheet === 'repeat-entry'}
        // Entry is a focused calculator, so start it at the largest available
        // detent. The form still compacts its controls to avoid making the
        // bottom keypad rows a scroll target on short iPhones.
        defaultHeightRatio={sheet === 'entry' || sheet === 'repeat-entry' ? 1 : 0.8}
        contentHeight={sheet === 'entry' || sheet === 'repeat-entry' ? entryContentHeight : 0}
        testID={sheet ? `${sheet}-sheet` : undefined}
      >
        <SheetBody
          sheet={sheet}
          entry={
            <EntrySheet
            key={activeQuickEntryDraft ? `quick-entry-${quickEntryPresentationToken}` : 'new-entry'}
            expCats={state.expCats}
            incCats={state.incCats}
            y={cursor.y}
            m={cursor.m}
            day={selectedDay}
            today={todayDate}
            symbol={symbol}
            editing={editing ?? undefined}
            initialDraft={activeQuickEntryDraft ?? undefined}
            repeatManagement={sheet === 'repeat-entry'}
            onSave={handleSubmit}
            onDelete={handleDelete}
            onClose={sheet === 'repeat-entry' ? openRepeats : closeSheet}
            onContentHeightChange={setEntryContentHeight}
            ScrollContainer={BottomSheetScrollView}
            />
          }
          settings={
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
            onOpenHouseholdSync={openHouseholdSync}
            nearbySharingPaired={householdSync.model.syncNow !== 'not-paired'}
            onExportData={exportData}
            onImportZaim={importZaim}
            onExportHouseholdBackup={exportHouseholdBackup}
            onImportHouseholdBackup={importHouseholdBackup}
            hasCorruptStash={hasCorruptStash}
            onExportCorruptStash={exportCorruptStash}
            onDeleteAllData={deleteAllData}
            onClose={closeSheet}
            ScrollContainer={BottomSheetScrollView}
            />
          }
          budgets={
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
          }
          householdSync={
            <HouseholdSyncSheet
              model={householdSync.model}
              history={householdSync.history}
              onSyncNow={householdSync.onSyncNow}
              onRestore={householdSync.onRestore}
              onClose={backToSettings}
              ScrollContainer={BottomSheetScrollView}
            />
          }
          repeats={
            <RepeatsSheet
            recurrenceRules={state.recurrenceRules}
            today={todayDate}
            symbol={symbol}
            onEdit={openRepeatEdit}
            onDone={backToSettings}
            ScrollContainer={BottomSheetScrollView}
            />
          }
        />
      </BottomSheet>
      <SaveWave nonce={saveWaveNonce} color={colors.positive} testID="save-wave-overlay" />
    </View>
  );
}

/**
 * Keep one stable child under BottomSheetModal. Gorhom measures its content
 * while presenting; handing it `null` on the first render makes iOS sometimes
 * open a zero-height/empty sheet when the requested body is swapped in.
 */
function SheetBody({
  sheet,
  entry,
  settings,
  budgets,
  householdSync,
  repeats,
}: {
  sheet: Sheet | null;
  entry: React.ReactNode;
  settings: React.ReactNode;
  budgets: React.ReactNode;
  householdSync: React.ReactNode;
  repeats: React.ReactNode;
}) {
  // BottomSheetView measures its direct child on native. A Fragment can
  // flatten into a changing child list while the modal is swapping sheets;
  // iOS may then retain only the header-sized measurement. Keep one concrete
  // flexing view under the host for every sheet state so content swaps are
  // measured as a body, not as a transient fragment.
  const body =
    sheet === 'entry' || sheet === 'repeat-entry'
      ? entry
      : sheet === 'settings'
        ? settings
          : sheet === 'budgets'
            ? budgets
            : sheet === 'household-sync'
              ? householdSync
            : sheet === 'repeats'
            ? repeats
            : null;

  return (
    <View testID="sheet-body" style={styles.sheetBody}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // BottomSheetView has an explicit pixel height. A percentage gives gorhom a
  // concrete native measurement on its first iOS layout pass; flex:1 can be
  // measured as zero while the modal portal is still being presented.
  sheetBody: { height: '100%', minHeight: 0, width: '100%' },
  // Native SafeAreaView (AppShell) insets the top; web has no safe area, so add
  // the design's status offset there to keep content off the container edge.
  body: { flex: 1, paddingTop: Platform.OS === 'web' ? metrics.statusOffset : 0 },
});
