/**
 * CalendarScreen — the home tab (minimal for slice #3). The full month grid,
 * In/Out/Net strip and month navigation arrive in slice #4; here it shows the
 * selected day's label + net and that day's entries as `ListRow`s, or the
 * designed empty state (decision 8).
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  dayEntries,
  dayNet,
  monthEntries,
  signed,
  type Transaction,
} from '../domain';
import { ListRow } from '../ui';
import { useTheme, metrics, Txt } from '../theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface CalendarScreenProps {
  entries: Transaction[];
  y: number;
  m: number;
  day: number;
  symbol: string;
}

export function CalendarScreen({ entries, y, m, day, symbol }: CalendarScreenProps) {
  const { colors } = useTheme();
  const month = monthEntries(entries, { y, m });
  const rows = dayEntries(month, day);
  const net = dayNet(month, day);

  return (
    <View style={styles.screen}>
      <Txt variant="screenTitle">
        {MONTHS[m]} {y}
      </Txt>

      <View style={[styles.dayHeader, { borderBottomColor: colors.line }]}>
        <Txt variant="microLabel" tone="muted">
          {MONTHS[m].slice(0, 3)} {day}
        </Txt>
        <Txt
          variant="inlineAmount"
          tone={net > 0 ? 'positive' : net < 0 ? 'negative' : 'muted'}
        >
          {signed(net, symbol)}
        </Txt>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Txt variant="secondary" tone="dim" style={styles.emptyText}>
            No entries this day. Tap ＋ to add one.
          </Txt>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((entry) => (
            <ListRow key={entry.id} entry={entry} symbol={symbol} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: metrics.screenPadX, paddingTop: 12 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyText: { textAlign: 'center' },
  list: { paddingBottom: metrics.adReserve },
});
