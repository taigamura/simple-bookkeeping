/**
 * Root — the bespoke navigation host (decision 3). Owns the nav state (`tab`,
 * `sheet`) and the calendar cursor (current month + selected day), renders the
 * active screen, the custom TabBar, and the Entry/Settings sheets. No router.
 *
 * Store `state`/`update` are threaded in from `App` (single source of truth) so
 * the ledger and category seeds flow to the screens and new entries persist.
 * Month navigation is fixed to the current month here; it arrives in slice #4.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import {
  clampDay,
  decodeZaimBytes,
  parseZaimCsv,
  sampleEntries,
  serializeZaimCsv,
  shiftMonth,
  type Currency,
  type Transaction,
  type YM,
  type ZaimSkipTally,
} from '../domain';
import { strings } from '../i18n';
import * as auth from '../platform/auth';
import { shareTextFile } from '../platform/shareFile';
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

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: strings.common.cancel, style: 'cancel' },
      { text: strings.common.import, onPress: onConfirm },
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

  const closeSheet = () => setSheet(null);
  const openSettings = () => setSheet('settings');

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

  // Month navigation: shift the cursor and clamp the selected day into the new
  // month (e.g. Jan 31 → Feb 28) so the selection stays valid.
  const goMonth = (delta: number) => {
    const next = shiftMonth(cursor, delta);
    setCursor(next);
    setSelectedDay((d) => clampDay(d, next.y, next.m));
  };

  // save(): append the materialized entries, land on and re-select the target
  // day (keep the current selection if it's among them, e.g. daily fill), and
  // show the Calendar.
  const handleSave = (entries: Transaction[]) => {
    if (entries.length === 0) return;
    update({ entries: [...state.entries, ...entries] });
    const days = new Set(entries.map((e) => e.day));
    setSelectedDay((d) => (days.has(d) ? d : entries[0].day));
    setTab('calendar');
    setSheet(null);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.body}>
        {tab === 'calendar' ? (
          <CalendarScreen
            entries={state.entries}
            y={cursor.y}
            m={cursor.m}
            day={selectedDay}
            symbol={symbol}
            onSelectDay={setSelectedDay}
            onPrevMonth={() => goMonth(-1)}
            onNextMonth={() => goMonth(1)}
            onSettings={openSettings}
          />
        ) : (
          <SummaryScreen
            entries={state.entries}
            y={cursor.y}
            m={cursor.m}
            symbol={symbol}
            onSettings={openSettings}
          />
        )}
      </View>

      <TabBar tab={tab} onSelect={setTab} onAdd={() => setSheet('entry')} />

      <BottomSheet visible={sheet === 'entry'} onClose={closeSheet}>
        {sheet === 'entry' && (
          <EntrySheet
            expCats={state.expCats}
            incCats={state.incCats}
            y={cursor.y}
            m={cursor.m}
            day={selectedDay}
            symbol={symbol}
            onSave={handleSave}
            onClose={closeSheet}
          />
        )}
      </BottomSheet>

      <BottomSheet visible={sheet === 'settings'} onClose={closeSheet}>
        {sheet === 'settings' && (
          <SettingsSheet
            currency={state.currency}
            expCats={state.expCats}
            incCats={state.incCats}
            onChangeCurrency={(currency: Currency) => update({ currency })}
            onChangeExpCats={(expCats) => update({ expCats })}
            onChangeIncCats={(incCats) => update({ incCats })}
            onLoadSample={loadSample}
            onExportData={exportData}
            onImportZaim={importZaim}
            hasCorruptStash={hasCorruptStash}
            onExportCorruptStash={exportCorruptStash}
            lockEnabled={state.lockEnabled}
            lockAvailable={lockAvailable}
            onToggleLock={(lockEnabled) => update({ lockEnabled })}
            onClose={closeSheet}
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
