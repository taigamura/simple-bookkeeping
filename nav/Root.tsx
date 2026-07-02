/**
 * Root — the bespoke navigation host (decision 3). Owns the only two pieces of
 * nav state (`tab`, `sheet`), renders the active screen, the custom TabBar, and
 * the Entry/Settings sheets. No router library.
 *
 * The Entry and Settings sheets are empty placeholders in this slice — the FAB
 * opens Entry, the header ⚙ opens Settings, both dismiss. Settings already hosts
 * the Appearance (Dark/Light) control so the theme toggle is reachable and its
 * persistence (via the store) is demoable end-to-end.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CalendarScreen } from '../screens/CalendarScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { useTheme, metrics, accents, Txt, type ThemeMode } from '../theme';
import { AppShell } from './AppShell';
import { BottomSheet } from './BottomSheet';
import { IconButton } from './IconButton';
import { TabBar } from './TabBar';
import type { Sheet, Tab } from './types';

export function Root() {
  return (
    <AppShell>
      <Shell />
    </AppShell>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('calendar');
  const [sheet, setSheet] = useState<Sheet>(null);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View />
        <IconButton
          name="settings"
          accessibilityLabel="Settings"
          onPress={() => setSheet('settings')}
        />
      </View>

      <View style={styles.body}>
        {tab === 'calendar' ? <CalendarScreen /> : <SummaryScreen />}
      </View>

      <TabBar tab={tab} onSelect={setTab} onAdd={() => setSheet('entry')} />

      <BottomSheet visible={sheet === 'entry'} onClose={() => setSheet(null)}>
        <SheetHeader title="New Entry" onClose={() => setSheet(null)} />
        <Txt variant="secondary" tone="muted" style={styles.sheetHint}>
          Amount keypad, category chips & CTA land in slice #2.
        </Txt>
      </BottomSheet>

      <BottomSheet visible={sheet === 'settings'} onClose={() => setSheet(null)}>
        <SheetHeader title="Settings" onClose={() => setSheet(null)} />
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
  const { mode, colors, setMode } = useTheme();
  const options: ThemeMode[] = ['dark', 'light'];
  return (
    <View style={styles.section}>
      <Txt variant="microLabel" tone="dim">
        Appearance
      </Txt>
      <View style={[styles.segment, { backgroundColor: colors.card2 }]}>
        {options.map((opt) => {
          const active = mode === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => setMode(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.segmentItem,
                active && { backgroundColor: accents.positive },
              ]}
            >
              <Txt
                variant="listItem"
                tone={active ? 'onPositive' : 'muted'}
                style={styles.segmentLabel}
              >
                {opt === 'dark' ? 'Dark' : 'Light'}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: metrics.statusOffset,
    paddingHorizontal: metrics.screenPadX,
  },
  body: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetHint: { marginBottom: 12 },
  section: { gap: 10, marginTop: 4 },
  segment: {
    flexDirection: 'row',
    borderRadius: metrics.pill,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: metrics.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { textTransform: 'none' },
});
