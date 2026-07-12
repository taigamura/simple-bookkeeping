/**
 * CalendarScreen — the Calendar home (slice #4). Full month-at-a-glance:
 * header (month+year title, ‹ › nav, ⚙), an In/Out/Net strip bounded by
 * hairlines (plus a BUDGET remaining column once any budget is set, #50), the
 * 7-column month grid, then the selected day's label + net and its entries
 * (or the empty state from the core slice).
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  MONTH_NAMES,
  dayLabel,
  dayEntries,
  dayNet,
  expense,
  getRemainingBudget,
  income,
  isBudgetActive,
  monthEntries,
  net as monthNet,
  signed,
  yen,
  type Budgets,
  type Transaction,
  type YM,
} from '../domain';
import { strings } from '../i18n';
import { ListRow, MonthPager } from '../ui';
import { useTheme, metrics, mono, Txt, type Tone } from '../theme';
import { IconButton } from '../nav/IconButton';

interface CalendarScreenProps {
  entries: Transaction[];
  /** Monthly budgets (#50) — the strip grows a BUDGET column when any is set. */
  budgets: Budgets;
  /** Budget mode (#66): 'category' for per-category, 'total' for single monthly amount. */
  budgetMode: 'category' | 'total';
  /** Total monthly budget in total mode (#66); 0 = no total budget. */
  totalBudget: number;
  y: number;
  m: number;
  day: number;
  symbol: string;
  onSelectDay: (day: number) => void;
  /** Tap a day-list row to edit that entry (#43). */
  onEditEntry: (entry: Transaction) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Pager settle: adopt the absolute month it landed on (#48). */
  onMonthChange: (ym: YM) => void;
  onSettings: () => void;
}

const netTone = (n: number): Tone => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'muted');

export function CalendarScreen({
  entries,
  budgets,
  budgetMode,
  totalBudget,
  y,
  m,
  day,
  symbol,
  onSelectDay,
  onEditEntry,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  onSettings,
}: CalendarScreenProps) {
  const { colors } = useTheme();
  const month = monthEntries(entries, { y, m });
  const rows = dayEntries(month, day);
  const dNet = dayNet(month, day);
  // Mode-aware budget logic: check if any budget is active and calculate remaining.
  const budgetActive = isBudgetActive(budgetMode, budgets, totalBudget);
  const remaining = getRemainingBudget(budgetMode, budgets, totalBudget, month);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Txt variant="screenTitle">
          {MONTH_NAMES[m]} {y}
        </Txt>
        <View style={styles.headerActions}>
          <IconButton
            name="chevron-left"
            accessibilityLabel={strings.calendar.previousMonth}
            onPress={onPrevMonth}
          />
          <IconButton
            name="chevron-right"
            accessibilityLabel={strings.calendar.nextMonth}
            onPress={onNextMonth}
          />
          <IconButton name="settings" accessibilityLabel={strings.nav.settings} onPress={onSettings} />
        </View>
      </View>

      <View style={[styles.strip, { borderColor: colors.line }]}>
        <StripCol label={strings.calendar.in} value={yen(income(month), symbol)} tone="positive" />
        <StripCol label={strings.calendar.out} value={yen(expense(month), symbol)} tone="negative" />
        <StripCol
          label={strings.calendar.net}
          value={signed(monthNet(month), symbol)}
          tone="ink"
          strong
        />
        {/* BUDGET column (#50/#66): only exists once any budget is active in the
            current mode, so the strip stays three columns until opted in.
            Remaining is a magnitude while positive; overspend shows the true
            negative (signed, red), never clamped to zero. */}
        {budgetActive && (
          <StripCol
            label={strings.calendar.budget}
            value={remaining < 0 ? signed(remaining, symbol) : yen(remaining, symbol)}
            tone={remaining < 0 ? 'negative' : 'ink'}
          />
        )}
      </View>

      <MonthPager
        entries={entries}
        y={y}
        m={m}
        selectedDay={day}
        onSelectDay={onSelectDay}
        onMonthChange={onMonthChange}
      />

      <View style={[styles.dayHeader, { borderBottomColor: colors.line }]}>
        <Txt variant="microLabel" tone="muted">
          {dayLabel(y, m, day)}
        </Txt>
        <Txt variant="inlineAmount" tone={netTone(dNet)}>
          {signed(dNet, symbol)}
        </Txt>
      </View>

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Txt variant="secondary" tone="dim" style={styles.emptyText}>
            {strings.calendar.emptyDay}
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={[styles.dayCard, { backgroundColor: colors.card }]}>
            {rows.map((entry, i) => (
              <ListRow
                key={entry.id}
                entry={entry}
                symbol={symbol}
                first={i === 0}
                onPress={() => onEditEntry(entry)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function StripCol({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone: Tone;
  /** Net column: mono 700 rather than the 600 In/Out use (design §3). */
  strong?: boolean;
}) {
  return (
    <View style={styles.stripCol}>
      <Txt variant="microLabel" tone="dim">
        {label}
      </Txt>
      <Txt variant="inlineAmount" tone={tone} style={strong ? styles.stripNet : undefined}>
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
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    marginBottom: 16,
  },
  // In left · Out center · Net right — columns are content-sized and pushed
  // apart by `space-between` on the strip (design §3), not equal-flex + centered.
  stripCol: { gap: 4 },
  stripNet: { fontFamily: mono.bold },
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
});
