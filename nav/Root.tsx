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
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import {
  clampDay,
  decodeZaimBytes,
  materialize,
  parseZaimCsv,
  pruneBudgets,
  removeEntry,
  sampleEntries,
  serializeZaimCsv,
  shiftMonth,
  updateEntry,
  type Currency,
  type EntryDraft,
  type Transaction,
  type WeekendShift,
  type YM,
  type ZaimSkipTally,
} from '../domain';
import { strings } from '../i18n';
import * as auth from '../platform/auth';
import { entrySaved } from '../platform/haptics';
import { shareTextFile } from '../platform/shareFile';
import { BudgetsSheet } from '../screens/BudgetsSheet';
import { CalendarScreen } from '../screens/CalendarScreen';
import { EntrySheet } from '../screens/EntrySheet';
import { SettingsSheet } from '../screens/SettingsSheet';
import { SummaryScreen } from '../screens/SummaryScreen';
import type { AppState } from '../store';
import { metrics } from '../theme';
import { AppShell } from './AppShell';
import { BottomSheet } from './BottomSheet';
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
}: RootProps) {
  const [tab, setTab] = useState<Tab>('calendar');
  const [sheet, setSheet] = useState<Sheet>(null);
  // Which entry the Entry sheet is editing (#43); null = create mode.
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Calendar cursor. Month navigation lands in slice #4; for now it tracks the
  // real current month, with the selected day defaulting to today.
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<YM>({ y: today.getFullYear(), m: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const symbol = state.currency.symbol;

  // Whether this device can even satisfy the lock (#30) — checked once on
  // mount so the Settings toggle can be disabled-with-explanation rather
  // than let the user turn on a gate the device can't honor.
  const [lockAvailable, setLockAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    auth.isAuthAvailable().then((available) => {
      if (alive) setLockAvailable(available);
    });
    return () => {
      alive = false;
    };
  }, []);

  // One-time boot notice (#28): fires once per corrupt boot, off
  // `showCorruptNotice` (this session's load result), never off
  // `hasCorruptStash` (which stays true across later, healthy boots too).
  useEffect(() => {
    if (showCorruptNotice) {
      notify(strings.corruptNotice.title, strings.corruptNotice.message);
    }
  }, [showCorruptNotice]);

  // Closing deliberately leaves `editing` alone (#47): the sheet body now stays
  // mounted through the dismiss animation, so clearing it here would flip an
  // edit-mode EntrySheet to create-mode chrome mid-slide. Every open path sets
  // it explicitly instead (openEntry → null, openEdit → the entry).
  const closeSheet = () => setSheet(null);
  const openSettings = () => setSheet('settings');

  // Settings ⇄ Budgets is a swap, never a stack (#49): the outgoing modal's
  // dismiss fires *after* `sheet` already points at the incoming one, so each
  // BottomSheet's onClose only clears the nav state if it is still the open
  // sheet — otherwise the swap's trailing onDismiss would cancel the incoming
  // present.
  const sheetDismissed = (which: Sheet) => () =>
    setSheet((s) => (s === which ? null : s));
  const openBudgets = () => setSheet('budgets');
  const backToSettings = () => setSheet('settings');

  // openEntry(): the ＋ button — always create mode (clear any prior editing).
  const openEntry = () => {
    setEditing(null);
    setSheet('entry');
  };

  // openEdit(): tap a day-list row → edit that entry. Re-select its day so the
  // Calendar returns to it after save/delete.
  const openEdit = (entry: Transaction) => {
    setEditing(entry);
    setSelectedDay(entry.day);
    setSheet('entry');
  };

  // loadSample(): replace the ledger with the July-2026 demo set (stable ids)
  // and jump the cursor there so the entries are immediately visible.
  const loadSample = () => {
    update({ entries: sampleEntries() });
    setCursor({ y: 2026, m: 6 });
    setSelectedDay(1);
    setTab('calendar');
    setSheet(null);
  };

  // exportData(): serialize the full ledger to a Zaim-format CSV and hand it
  // to the share sheet. Restore is the existing "Import from Zaim" row below —
  // an exported file round-trips through it unchanged, so no new import UI.
  const exportData = () => {
    shareTextFile('kaji-export.csv', serializeZaimCsv(state.entries));
  };

  // exportCorruptStash(): share the raw unreadable blob kept by the #28 safety
  // net, so a stuck user can get their pre-corruption data off the device.
  const exportCorruptStash = async () => {
    const raw = await readCorruptStash();
    if (raw) shareTextFile('kaji-unreadable-backup.txt', raw);
  };

  // importZaim(): pick a Zaim CSV export → decode (Shift-JIS or UTF-8) →
  // parse against the current ledger (so re-importing an overlapping export
  // skips rows already present) → native Import/Cancel confirmation with the
  // entry count and skip-reason breakdown → merge entries and any new
  // categories into the ledger through the normal update() path. Canceling
  // the picker or the confirmation writes nothing.
  const importZaim = async () => {
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

    const result = parseZaimCsv(text, {
      expCats: state.expCats,
      incCats: state.incCats,
      entries: state.entries,
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

  // handleSubmit(): the Entry sheet's save. In edit mode, overwrite the entry by
  // id (preserving id/y/m/day) via the pure `updateEntry`; otherwise materialize
  // the draft and append. Either way land on the relevant day and show the
  // Calendar.
  const handleSubmit = (draft: EntryDraft, weekendShift: WeekendShift) => {
    if (editing) {
      entrySaved();
      update({ entries: updateEntry(state.entries, editing.id, draft) });
      setSelectedDay(editing.day);
    } else {
      const entries = materialize(draft, weekendShift);
      if (entries.length === 0) return;
      entrySaved();
      update({ entries: [...state.entries, ...entries] });
      const days = new Set(entries.map((e) => e.day));
      setSelectedDay((d) => (days.has(d) ? d : entries[0].day));
    }
    setTab('calendar');
    setSheet(null);
  };

  // handleDelete(): guarded by a native confirm (web window.confirm fallback);
  // on confirm, drop the entry via the pure `removeEntry` and return to the
  // Calendar with the same day still selected.
  const handleDelete = (id: string) => {
    confirm(
      strings.entry.deleteConfirmTitle,
      strings.entry.deleteConfirmMessage,
      () => {
        update({ entries: removeEntry(state.entries, id) });
        setTab('calendar');
        setSheet(null);
      },
      strings.common.delete,
      true,
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.body}>
        {tab === 'calendar' ? (
          <CalendarScreen
            entries={state.entries}
            budgets={state.budgets}
            y={cursor.y}
            m={cursor.m}
            day={selectedDay}
            symbol={symbol}
            onSelectDay={setSelectedDay}
            onEditEntry={openEdit}
            onPrevMonth={() => goMonth(-1)}
            onNextMonth={() => goMonth(1)}
            onMonthChange={setMonth}
            onSettings={openSettings}
          />
        ) : (
          <SummaryScreen
            entries={state.entries}
            budgets={state.budgets}
            y={cursor.y}
            m={cursor.m}
            symbol={symbol}
            onSettings={openSettings}
          />
        )}
      </View>

      <TabBar tab={tab} onSelect={setTab} onAdd={openEntry} />

      {/* Sheet bodies are passed unconditionally (#47) — never gated on `sheet`.
          BottomSheet's dynamic sizing measures the content at present() time, so
          gating on the open state raced the measurement (blank first open,
          collapsed initial detent). The modal only mounts children while
          presented, so each open still gets a fresh EntrySheet/SettingsSheet. */}
      <BottomSheet visible={sheet === 'entry'} onClose={closeSheet} anchorBottom>
        <EntrySheet
          expCats={state.expCats}
          incCats={state.incCats}
          y={cursor.y}
          m={cursor.m}
          day={selectedDay}
          symbol={symbol}
          editing={editing ?? undefined}
          onSave={handleSubmit}
          onDelete={handleDelete}
          onClose={closeSheet}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'settings'} onClose={sheetDismissed('settings')}>
        <SettingsSheet
          currency={state.currency}
          expCats={state.expCats}
          incCats={state.incCats}
          onChangeCurrency={(currency: Currency) => update({ currency })}
          // Deleting an expense category silently drops its budget entry (#49).
          onChangeExpCats={(expCats) =>
            update({ expCats, budgets: pruneBudgets(state.budgets, expCats) })
          }
          onChangeIncCats={(incCats) => update({ incCats })}
          onOpenBudgets={openBudgets}
          onLoadSample={loadSample}
          onExportData={exportData}
          onImportZaim={importZaim}
          hasCorruptStash={hasCorruptStash}
          onExportCorruptStash={exportCorruptStash}
          lockEnabled={state.lockEnabled}
          lockAvailable={lockAvailable}
          onToggleLock={(lockEnabled) => update({ lockEnabled })}
          onClose={closeSheet}
          ScrollContainer={BottomSheetScrollView}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'budgets'} onClose={sheetDismissed('budgets')}>
        <BudgetsSheet
          expCats={state.expCats}
          budgets={state.budgets}
          symbol={symbol}
          onChangeBudgets={(budgets) => update({ budgets })}
          onDone={backToSettings}
          ScrollContainer={BottomSheetScrollView}
        />
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
