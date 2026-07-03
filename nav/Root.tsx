/**
 * Root — the bespoke navigation host (decision 3). Owns the nav state (`tab`,
 * `sheet`) and the calendar cursor (current month + selected day), renders the
 * active screen, the custom TabBar, and the Entry/Settings sheets. No router.
 *
 * Store `state`/`update` are threaded in from `App` (single source of truth) so
 * the ledger and category seeds flow to the screens and new entries persist.
 * Month navigation is fixed to the current month here; it arrives in slice #4.
 */
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  clampDay,
  sampleEntries,
  shiftMonth,
  type Currency,
  type Transaction,
  type YM,
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
