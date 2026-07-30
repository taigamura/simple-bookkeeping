/**
 * SummaryScreen — a month's cash-flow at a glance (slice #5). The net figure
 * lives on the saturated `deep` hero block (large mono net + in/out SplitBar +
 * legend), over the ranked spending-by-category bars (expenses, highest-first,
 * scaled to the max). Reads the same store
 * aggregation as Calendar. With any budget set (#51) the net card gains a
 * budget-left line (same Σ budgets − expenses formula as the Calendar strip)
 * and budgeted category bars show spent / budget, red when over.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  MONTH_NAMES,
  categoryBreakdown,
  getRemainingBudget,
  isBudgetActive,
  monthEntries,
  net as monthNet,
  splitProportions,
  signed,
  yen,
  type Budgets,
  type Transaction,
} from '../domain';
import { strings } from '../i18n';
import { CategoryBar, SplitBar } from '../ui';
import { useTheme, metrics, Txt } from '../theme';
import { IconButton } from '../nav/IconButton';

interface SummaryScreenProps {
  entries: Transaction[];
  budgets: Budgets;
  /** Budget mode (#66): 'category' for per-category, 'total' for single monthly amount. */
  budgetMode: 'category' | 'total';
  /** Total monthly budget in total mode (#66); 0 = no total budget. */
  totalBudget: number;
  y: number;
  m: number;
  symbol: string;
  onSettings: () => void;
}

export function SummaryScreen({
  entries,
  budgets,
  budgetMode,
  totalBudget,
  y,
  m,
  symbol,
  onSettings,
}: SummaryScreenProps) {
  const { colors } = useTheme();
  const month = monthEntries(entries, { y, m });
  const total = monthNet(month);
  const split = splitProportions(month);
  // In total mode, category rows show spend only; in category mode, show per-category budgets.
  const breakdown = categoryBreakdown(month, budgets, budgetMode);
  // Mode-aware budget logic: check if any budget is active and calculate remaining.
  const budgetActive = isBudgetActive(budgetMode, budgets, totalBudget);
  const remaining = getRemainingBudget(budgetMode, budgets, totalBudget, month);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Txt variant="screenTitle">{strings.nav.summary}</Txt>
          <Txt variant="secondary" tone="muted" style={styles.subtitle}>
            {MONTH_NAMES[m]} {y}
          </Txt>
        </View>
        <IconButton name="settings" accessibilityLabel={strings.nav.settings} onPress={onSettings} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* The `deep` hero block — Kippu's one saturated surface, and the only
            place the headline number lives. Everything inside reads on-deep. */}
        <View style={[styles.card, { backgroundColor: colors.deep }]}>
          <Txt variant="microLabel" tone="onDeepMuted">
            {strings.summary.netThisMonth}
          </Txt>
          <Txt variant="summaryNet" tone="onDeep" style={styles.net}>
            {signed(total, symbol)}
          </Txt>

          <SplitBar
            incomeFraction={split.incomeFraction}
            expenseFraction={split.expenseFraction}
            onDeep
          />

          <View style={styles.legend}>
            <Legend label={strings.calendar.in} value={yen(split.income, symbol)} income />
            <Legend label={strings.calendar.out} value={yen(split.expense, symbol)} />
          </View>

          {/* Budget-left line (#51/#66): only exists once any budget is active
              in the current mode, so the card stays unchanged until opted in.
              Overspend still reads as a true negative; on the hero it is called
              out by full-strength white rather than red, which would not hold
              up against the deep fill. */}
          {budgetActive && (
            <View style={[styles.budgetRow, { borderTopColor: HERO_RULE }]}>
              <Txt variant="secondary" tone="onDeepMuted">
                {strings.summary.budgetLeft}
              </Txt>
              <Txt variant="inlineAmount" tone={remaining < 0 ? 'onDeep' : 'onDeepMuted'}>
                {remaining < 0 ? signed(remaining, symbol) : yen(remaining, symbol)}
              </Txt>
            </View>
          )}
        </View>

        <Txt variant="microLabel" tone="dim" style={styles.sectionLabel}>
          {strings.summary.spendingByCategory}
        </Txt>

        {breakdown.length === 0 ? (
          <Txt variant="secondary" tone="dim" style={styles.empty}>
            {strings.summary.noSpending}
          </Txt>
        ) : (
          breakdown.map((slice) => (
            <CategoryBar
              key={slice.category}
              category={slice.category}
              total={slice.total}
              fraction={slice.fraction}
              budget={slice.budget}
              symbol={symbol}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** Hairline on the hero block — the palette's `line` is tuned for the ground. */
const HERO_RULE = 'rgba(255,255,255,.22)';

/**
 * One in/out key on the hero block. Income takes the solid white swatch that
 * matches its SplitBar segment; expense takes the translucent one.
 */
function Legend({ label, value, income = false }: { label: string; value: string; income?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.dot,
          { backgroundColor: income ? colors.onDeep : 'rgba(255,255,255,.42)' },
        ]}
      />
      <Txt variant="secondary" tone="onDeepMuted">
        {label}
      </Txt>
      <Txt variant="inlineAmount" tone={income ? 'onDeep' : 'onDeepMuted'}>
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
    borderRadius: metrics.heroRadius,
    padding: 20,
    gap: 14,
    marginBottom: 24,
  },
  net: { marginTop: -2 },
  legend: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { marginBottom: 14 },
  empty: { paddingVertical: 8 },
});
