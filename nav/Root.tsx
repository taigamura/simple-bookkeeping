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
import React, { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import {
  clampDay,
  decodeZaimBytes,
  parseZaimCsv,
  sampleEntries,
  shiftMonth,
  type Currency,
  type Transaction,
  type YM,
  type ZaimSkipTally,
} from '../domain';
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
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts: string[] = [];
  if (skipped.transfer > 0) parts.push(`${plural(skipped.transfer, 'transfer')} skipped`);
  if (skipped.balanceAdjustment > 0) {
    parts.push(`${plural(skipped.balanceAdjustment, 'balance adjustment')} skipped`);
  }
  if (skipped.malformed > 0) parts.push(`${plural(skipped.malformed, 'malformed row')} skipped`);
  return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
}

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Import', onPress: onConfirm },
    ]);
  }
}

export function Root({ state, update }: RootProps) {
  return (
    <AppShell>
      <Shell state={state} update={update} />
    </AppShell>
  );
}

function Shell({ state, update }: RootProps) {
  const [tab, setTab] = useState<Tab>('calendar');
  const [sheet, setSheet] = useState<Sheet>(null);

  // Calendar cursor. Month navigation lands in slice #4; for now it tracks the
  // real current month, with the selected day defaulting to today.
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<YM>({ y: today.getFullYear(), m: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const symbol = state.currency.symbol;
  const showAd = !state.premium;

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

  // importZaim(): pick a Zaim CSV export → decode (Shift-JIS) → parse →
  // native Import/Cancel confirmation with the entry count → merge entries
  // and any new categories into the ledger through the normal update() path.
  // Canceling the picker or the confirmation writes nothing.
  const importZaim = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
    if (picked.canceled) return;

    const bytes = new Uint8Array(await new File(picked.assets[0].uri).arrayBuffer());
    const text = decodeZaimBytes(bytes);
    if (!text) {
      notify("Doesn't look like a Zaim export", 'No entries were imported.');
      return;
    }

    const result = parseZaimCsv(text, { expCats: state.expCats, incCats: state.incCats });
    if (result.entries.length === 0) {
      notify(
        'No entries found',
        `No importable rows were found in that file.${skipSummary(result.skipped)}`,
      );
      return;
    }

    const message = `${result.entries.length} entries ready to import${skipSummary(result.skipped)}`;
    confirm('Import from Zaim', message, () => {
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
            showAd={showAd}
          />
        ) : (
          <SummaryScreen
            entries={state.entries}
            y={cursor.y}
            m={cursor.m}
            symbol={symbol}
            onSettings={openSettings}
            showAd={showAd}
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
            showAd={showAd}
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
            premium={state.premium}
            onChangeCurrency={(currency: Currency) => update({ currency })}
            onChangeExpCats={(expCats) => update({ expCats })}
            onChangeIncCats={(incCats) => update({ incCats })}
            onTogglePremium={(premium) => update({ premium })}
            onLoadSample={loadSample}
            onImportZaim={importZaim}
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
