/**
 * CalendarScreen — the Calendar home (slice #4). Full month-at-a-glance:
 * header (month+year title, ‹ › nav, ⚙), an In/Out/Net strip bounded by
 * hairlines, the 7-column month grid, then the selected day's label + net and
 * its entries (or the empty state from the core slice).
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  MONTH_NAMES,
  dayEntries,
  dayNet,
  expense,
  income,
  monthEntries,
  net as monthNet,
  signed,
  yen,
  type Transaction,
} from '../domain';
import { AdCard, CalendarGrid, ListRow } from '../ui';
import { useTheme, metrics, Txt, type Tone } from '../theme';
import { IconButton } from '../nav/IconButton';

interface CalendarScreenProps {
  entries: Transaction[];
  y: number;
  m: number;
  day: number;
  symbol: string;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSettings: () => void;
  /** Free-tier ad slot above the tab bar; hidden for premium (decision 7). */
  showAd: boolean;
}

const netTone = (n: number): Tone => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'muted');

export function CalendarScreen({
  entries,
  y,
  m,
  day,
  symbol,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onSettings,
  showAd,
}: CalendarScreenProps) {
  const { colors } = useTheme();
  const month = monthEntries(entries, { y, m });
  const rows = dayEntries(month, day);
  const dNet = dayNet(month, day);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Txt variant="screenTitle">
          {MONTH_NAMES[m]} {y}
        </Txt>
        <View style={styles.headerActions}>
          <IconButton name="chevron-left" accessibilityLabel="Previous month" onPress={onPrevMonth} />
          <IconButton name="chevron-right" accessibilityLabel="Next month" onPress={onNextMonth} />
          <IconButton name="settings" accessibilityLabel="Settings" onPress={onSettings} />
        </View>
      </View>

      <View style={[styles.strip, { borderColor: colors.line }]}>
        <StripCol label="In" value={yen(income(month), symbol)} tone="positive" />
        <StripCol label="Out" value={yen(expense(month), symbol)} tone="negative" />
        <StripCol label="Net" value={signed(monthNet(month), symbol)} tone={netTone(monthNet(month))} />
      </View>

      <CalendarGrid
        y={y}
        m={m}
        monthEntries={month}
        selectedDay={day}
        onSelectDay={onSelectDay}
      />

      <View style={[styles.dayHeader, { borderBottomColor: colors.line }]}>
        <Txt variant="microLabel" tone="muted">
          {MONTH_NAMES[m].slice(0, 3)} {day}
        </Txt>
        <Txt variant="inlineAmount" tone={netTone(dNet)}>
          {signed(dNet, symbol)}
        </Txt>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Txt variant="secondary" tone="dim" style={styles.emptyText}>
            No entries this day. Tap ＋ to add one.
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={[styles.dayCard, { backgroundColor: colors.card }]}>
            {rows.map((entry, i) => (
              <ListRow key={entry.id} entry={entry} symbol={symbol} first={i === 0} />
            ))}
          </View>
        </ScrollView>
      )}

      {showAd && (
        <View style={styles.adSlot}>
          <AdCard variant="banner" />
        </View>
      )}
    </View>
  );
}

function StripCol({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <View style={styles.stripCol}>
      <Txt variant="microLabel" tone="dim">
        {label}
      </Txt>
      <Txt variant="inlineAmount" tone={tone}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: metrics.screenPadX, paddingTop: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strip: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    marginBottom: 16,
  },
  stripCol: { flex: 1, alignItems: 'center', gap: 4 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyText: { textAlign: 'center' },
  list: { paddingBottom: 8 },
  dayCard: {
    borderRadius: metrics.cardRadius,
    paddingHorizontal: 14,
  },
  adSlot: { marginTop: 'auto', paddingTop: 10, paddingBottom: 8 },
});
