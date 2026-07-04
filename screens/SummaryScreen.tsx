/**
 * SummaryScreen — a month's cash-flow at a glance (slice #5). Net card (large
 * mono net + in/out SplitBar + legend) over the ranked spending-by-category
 * bars (expenses, highest-first, scaled to the max). Reads the same store
 * aggregation as Calendar.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  MONTH_NAMES,
  categoryBreakdown,
  monthEntries,
  net as monthNet,
  splitProportions,
  signed,
  yen,
  type Transaction,
} from '../domain';
import { CategoryBar, SplitBar } from '../ui';
import { useTheme, metrics, Txt, type Tone } from '../theme';
import { IconButton } from '../nav/IconButton';

interface SummaryScreenProps {
  entries: Transaction[];
  y: number;
  m: number;
  symbol: string;
  onSettings: () => void;
}

export function SummaryScreen({ entries, y, m, symbol, onSettings }: SummaryScreenProps) {
  const { colors } = useTheme();
  const month = monthEntries(entries, { y, m });
  const total = monthNet(month);
  const split = splitProportions(month);
  const breakdown = categoryBreakdown(month);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Txt variant="screenTitle">Summary</Txt>
          <Txt variant="secondary" tone="muted" style={styles.subtitle}>
            {MONTH_NAMES[m]} {y}
          </Txt>
        </View>
        <IconButton name="settings" accessibilityLabel="Settings" onPress={onSettings} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Txt variant="microLabel" tone="dim">
            Net this month
          </Txt>
          <Txt variant="summaryNet" tone="positive" style={styles.net}>
            {signed(total, symbol)}
          </Txt>

          <SplitBar
            incomeFraction={split.incomeFraction}
            expenseFraction={split.expenseFraction}
          />

          <View style={styles.legend}>
            <Legend label="In" value={yen(split.income, symbol)} tone="positive" />
            <Legend label="Out" value={yen(split.expense, symbol)} tone="negative" />
          </View>
        </View>

        <Txt variant="microLabel" tone="dim" style={styles.sectionLabel}>
          Spending by category
        </Txt>

        {breakdown.length === 0 ? (
          <Txt variant="secondary" tone="dim" style={styles.empty}>
            No spending this month.
          </Txt>
        ) : (
          breakdown.map((slice) => (
            <CategoryBar
              key={slice.category}
              category={slice.category}
              total={slice.total}
              fraction={slice.fraction}
              symbol={symbol}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Legend({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const { colors } = useTheme();
  const dotColor = tone === 'positive' ? colors.positive : colors.negative;
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Txt variant="secondary" tone="muted">
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
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subtitle: { marginTop: 2 },
  scroll: { flex: 1 },
  body: { paddingBottom: 8 },
  card: {
    borderRadius: metrics.cardRadius,
    padding: 18,
    gap: 12,
    marginBottom: 24,
  },
  net: { marginTop: -2 },
  legend: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { marginBottom: 14 },
  empty: { paddingVertical: 8 },
});
