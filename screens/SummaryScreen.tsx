/**
 * SummaryScreen — a month's cash-flow at a glance (slice #5). The net figure
 * lives on the saturated `deep` hero block (large mono net + in/out SplitBar +
 * legend), over the ranked spending-by-category bars (expenses, highest-first,
 * scaled to the max). Reads the same store
 * aggregation as Calendar. With any budget set (#51) the net card gains a
 * budget-left line (same Σ budgets − expenses formula as the Calendar strip)
 * and budgeted category bars show spent / budget, red when over.
 *
 * ## Motion
 *
 * Every headline figure here — the hero net, the two Legend values, the
 * budget-left line — is a mono variant, which is the one precondition
 * `AnimatedNumber` needs to roll safely (see its header): a month swap or a
 * new entry now reads as that number *moving* to its new value rather than
 * being replaced by an unrelated one. `Legend` used to take a preformatted
 * string; it now takes the raw number plus the same formatter the caller
 * would have used, so it can hand both to `AnimatedNumber` instead of
 * pre-baking the string this screen can no longer see the animation of.
 *
 * The category list gets a staggered entrance — each bar fades and rises in,
 * delayed by `staggerDelay(index)` — because on first load the whole list
 * appears at once regardless of how many categories exist; a stagger reads it
 * as a ranked list being *drawn*, not a static block of rows. `LinearTransition`
 * rides along so that if the ranking changes between months (a category
 * overtakes another), the rows slide to their new position instead of
 * repainting in place. Both are handed to `Animated.View` only when
 * `useMotion().enabled` is true — passing `undefined` for `entering`/`layout`
 * is how reanimated turns a layout animation off, and doing it from our own
 * hook is what keeps this in sync with Kaji's in-app motion preference.
 *
 * Both builders also carry `.reduceMotion(ReduceMotion.Never)`. This was
 * originally left to the builder's own default (`ReduceMotion.System`) on the
 * theory that gating the *whole prop* on `useMotion().enabled` was enough —
 * it wasn't: `enabled` deciding to pass the real builder instead of
 * `undefined` doesn't stop the builder from *also* re-checking the OS flag
 * itself underneath, so a user whose OS reports reduce-motion got nothing
 * even after `enabled` correctly resolved to `true` (e.g. Kaji's own "Full"
 * preference, which exists specifically to override that OS flag). See
 * `theme/motion.ts`'s `withAppTiming`/`withAppSpring` for the same bug in
 * every non-layout animation in this app, and why `.reduceMotion(Never)` is
 * the fix, not a redundant safety net.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

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
import { CategoryBar, SplitBar, AnimatedNumber } from '../ui';
import { useTheme, useMotion, metrics, staggerDelay, ReduceMotion, Txt } from '../theme';
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
  const { enabled: motionEnabled } = useMotion();
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
          <AnimatedNumber
            value={total}
            format={(n) => signed(n, symbol)}
            variant="summaryNet"
            tone="onDeep"
            style={styles.net}
          />

          <SplitBar
            incomeFraction={split.incomeFraction}
            expenseFraction={split.expenseFraction}
            onDeep
          />

          <View style={styles.legend}>
            <Legend
              label={strings.calendar.in}
              value={split.income}
              format={(n) => yen(n, symbol)}
              income
            />
            <Legend
              label={strings.calendar.out}
              value={split.expense}
              format={(n) => yen(n, symbol)}
            />
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
              <AnimatedNumber
                value={remaining}
                format={(n) => (n < 0 ? signed(n, symbol) : yen(n, symbol))}
                variant="inlineAmount"
                tone={remaining < 0 ? 'onDeep' : 'onDeepMuted'}
              />
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
          breakdown.map((slice, index) => (
            <Animated.View
              key={slice.category}
              entering={
                motionEnabled
                  ? FadeInDown.delay(staggerDelay(index)).reduceMotion(ReduceMotion.Never)
                  : undefined
              }
              layout={
                motionEnabled ? LinearTransition.reduceMotion(ReduceMotion.Never) : undefined
              }
            >
              <CategoryBar
                category={slice.category}
                total={slice.total}
                fraction={slice.fraction}
                budget={slice.budget}
                symbol={symbol}
              />
            </Animated.View>
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
 *
 * Takes the raw number plus a formatter — rather than a preformatted string —
 * so it can hand both to `AnimatedNumber` and let the in/out totals roll along
 * with the hero net instead of jumping a beat behind it.
 */
function Legend({
  label,
  value,
  format,
  income = false,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  income?: boolean;
}) {
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
      <AnimatedNumber
        value={value}
        format={format}
        variant="inlineAmount"
        tone={income ? 'onDeep' : 'onDeepMuted'}
      />
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
