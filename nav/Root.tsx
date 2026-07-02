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
  DEFAULT_CURRENCY,
  clampDay,
  shiftMonth,
  type Transaction,
  type YM,
} from '../domain';
import { CalendarScreen } from '../screens/CalendarScreen';
import { EntrySheet } from '../screens/EntrySheet';
import { SummaryScreen } from '../screens/SummaryScreen';
import type { AppState } from '../store';
import { useTheme, metrics, Txt, type ThemeMode } from '../theme';
import { SegmentedToggle } from '../ui';
import { AppShell } from './AppShell';
import { BottomSheet } from './BottomSheet';
import { IconButton } from './IconButton';
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

  const symbol = DEFAULT_CURRENCY.symbol;

  const closeSheet = () => setSheet(null);
  const openSettings = () => setSheet('settings');

  // Month navigation: shift the cursor and clamp the selected day into the new
  // month (e.g. Jan 31 → Feb 28) so the selection stays valid.
  const goMonth = (delta: number) => {
    const next = shiftMonth(cursor, delta);
    setCursor(next);
    setSelectedDay((d) => clampDay(d, next.y, next.m));
  };

  // save(): append the entry, land on and re-select its day, show the Calendar.
  const handleSave = (entry: Transaction) => {
    update({ entries: [...state.entries, entry] });
    setSelectedDay(entry.day);
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
        <SheetHeader title="Settings" onClose={closeSheet} />
        <Appearance />
      </BottomSheet>
    </View>
  );
}

/** Sheet title row with a round ✕ close button (decision 6 — icon by intent). */
function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.sheetHeader}>
      <Txt variant="screenTitle">{title}</Txt>
      <IconButton name="x" accessibilityLabel="Close" onPress={onClose} />
    </View>
  );
}

/** Appearance control — the manual Dark/Light switch (decision 9). */
function Appearance() {
  const { mode, setMode } = useTheme();
  return (
    <View style={styles.section}>
      <Txt variant="microLabel" tone="dim">
        Appearance
      </Txt>
      <SegmentedToggle<ThemeMode>
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        value={mode}
        onChange={setMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Native SafeAreaView (AppShell) insets the top; web has no safe area, so add
  // the design's status offset there to keep content off the container edge.
  body: { flex: 1, paddingTop: Platform.OS === 'web' ? metrics.statusOffset : 0 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  section: { gap: 10, marginTop: 4 },
});
