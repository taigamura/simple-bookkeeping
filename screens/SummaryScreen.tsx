/**
 * SummaryScreen — a period's cash-flow at a glance (slice #5). The net figure
 * lives on the saturated `deep` hero block (large mono net + in/out SplitBar +
 * legend), over the ranked spending-by-category bars (expenses, highest-first,
 * scaled to the max). Reads the same store
 * aggregation as Calendar. With any budget set (#51) the net card gains a
 * budget-left line (same Σ budgets − expenses formula as the Calendar strip)
 * and budgeted category bars show spent / budget, red when over.
 *
 * ## Period and granularity
 *
 * The period is the shared nav cursor plus a `granularity` (Monthly | Annual,
 * persisted; see `domain/summary.ts`). Annual is the calendar year Jan–Dec.
 * Both the swipe and the toggle move the *same* cursor the Calendar tab uses,
 * so there is one "where am I" in the app rather than two that can disagree —
 * and because a granularity flip leaves the cursor's month untouched, flipping
 * Annual → Monthly lands back on the month you left.
 *
 * Budgets are deliberately hidden in Annual mode. They are stored as monthly
 * amounts, so any annual reading of them has to either multiply by twelve —
 * which claims a full year of allowance eight months into an in-progress year,
 * reading as wildly under budget — or multiply by elapsed months, which is
 * accurate but invisible unless spelled out. Annual is a pure cash-flow view
 * instead: net, in/out, ranked spending, nothing that can lie.
 *
 * ## Motion
 *
 * The whole hero block — net, both Legend values, budget-left — changes as one
 * on a period swap: `HeroPour` fills the card like a vessel, a single rising
 * front carrying every figure to its new value together. The figures are still
 * `AnimatedNumber`s (and still mono variants, `Legend` still handing it the raw
 * number plus a formatter rather than a pre-baked string) but each passes
 * `roll={false}`: the pour owns the change, and a per-figure digit-roll
 * underneath it would be a second, competing animation on the same numbers. The
 * roll is kept for the Calendar's In/Out/Net strip, which has no pour.
 *
 * That single shared front is why the hero card sits *outside* the pager and
 * only the category list pages under the finger. Putting the hero inside would
 * give each page its own card and its own `HeroPour`/`AnimatedNumber` instances,
 * so the headline figure would hard-cut per page instead of pouring once at the
 * settle — the one place on the screen most worth animating.
 *
 * The period subtitle slides `TITLE_TRAVEL` and cross-fades in the direction
 * the period moved, the same hand-rolled treatment (and the same reason for it
 * being hand-rolled) as `CalendarScreen`'s title block: the subtitle never
 * unmounts, so there is nothing for an `entering` preset to attach to, and the
 * direction has to be derived from which way the cursor moved.
 *
 * The category list gets a staggered entrance — each bar fades and rises in,
 * delayed by `staggerDelay(index)` — because on first load the whole list
 * appears at once regardless of how many categories exist; a stagger reads it
 * as a ranked list being *drawn*, not a static block of rows. `LinearTransition`
 * rides along so that if the ranking changes between periods (a category
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
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {
  categoryBreakdown,
  getRemainingBudget,
  isBudgetActive,
  net as periodNet,
  periodEntries,
  periodKey,
  periodLabel,
  shiftPeriod,
  splitProportions,
  signed,
  yen,
  type Budgets,
  type SummaryGranularity,
  type Transaction,
  type YM,
} from '../domain';
import { strings } from '../i18n';
import {
  CategoryBar,
  SplitBar,
  AnimatedNumber,
  HeroPour,
  PeriodPager,
  SegmentedToggle,
  useOverscrollSlosh,
} from '../ui';
import {
  useTheme,
  useMotion,
  durations,
  easings,
  metrics,
  staggerDelay,
  withAppTiming,
  ReduceMotion,
  Txt,
} from '../theme';
import { IconButton, ThemeToggleButton } from '../nav/IconButton';

/** How far the period subtitle travels on a period swap, in either direction. */
const TITLE_TRAVEL = 12;

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
  /** Monthly or annual aggregation; persisted by the host. */
  granularity: SummaryGranularity;
  onChangeGranularity: (granularity: SummaryGranularity) => void;
  /** Commit the absolute period a swipe settled on — moves the shared cursor. */
  onPeriodChange: (ym: YM) => void;
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
  granularity,
  onChangeGranularity,
  onPeriodChange,
  onSettings,
}: SummaryScreenProps) {
  const { colors } = useTheme();
  const { enabled: motionEnabled } = useMotion();
  const annual = granularity === 'annual';
  const cursor: YM = { y, m };
  const period = periodEntries(entries, cursor, granularity);
  const total = periodNet(period);
  const split = splitProportions(period);
  // Mode-aware budget logic: check if any budget is active and calculate
  // remaining. Never in annual mode — see the file header.
  const budgetActive = !annual && isBudgetActive(budgetMode, budgets, totalBudget);
  const remaining = getRemainingBudget(budgetMode, budgets, totalBudget, period);

  // Subtitle direction cue: which way the period moved. Compared on the
  // absolute month index (y*12+m) so the December -> January turn still reads
  // as forward rather than as a jump backwards.
  const titleTranslate = useSharedValue(0);
  const titleOpacity = useSharedValue(1);
  const prevIndex = useRef(y * 12 + m);

  useEffect(() => {
    const index = y * 12 + m;
    if (!motionEnabled) {
      titleTranslate.value = 0;
      titleOpacity.value = 1;
      prevIndex.current = index;
      return;
    }
    if (index === prevIndex.current) return;
    const forward = index > prevIndex.current;
    titleTranslate.value = forward ? TITLE_TRAVEL : -TITLE_TRAVEL;
    titleOpacity.value = 0;
    titleTranslate.value = withAppTiming(0, {
      duration: durations.base,
      easing: easings.standard,
    });
    titleOpacity.value = withAppTiming(1, {
      duration: durations.base,
      easing: easings.standard,
    });
    prevIndex.current = index;
    // titleTranslate/titleOpacity/prevIndex are shared values and a ref, not
    // reactive inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y, m, motionEnabled]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateX: titleTranslate.value }],
  }));

  // Overscroll slosh: pulling the screen past the top lets the hero trail the
  // pulled content and spring-settle on release (device-only; web never
  // rubber-bands). Applied to the hero only when motion is on.
  const { scrollHandler, sloshStyle } = useOverscrollSlosh();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Txt variant="screenTitle">{strings.nav.summary}</Txt>
          <Animated.View style={titleAnimatedStyle}>
            <Txt variant="secondary" tone="muted" style={styles.subtitle}>
              {periodLabel(cursor, granularity)}
            </Txt>
          </Animated.View>
        </View>
        <View style={styles.headerActions}>
          <ThemeToggleButton />
          <IconButton name="settings" accessibilityLabel={strings.nav.settings} onPress={onSettings} />
        </View>
      </View>

      <View style={styles.granularity}>
        <SegmentedToggle
          options={[
            { value: 'monthly', label: strings.summary.monthly },
            { value: 'annual', label: strings.summary.annual },
          ]}
          value={granularity}
          onChange={onChangeGranularity}
        />
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* The `deep` hero block — Kippu's one saturated surface, and the only
            place the headline number lives. Everything inside reads on-deep.
            Fixed, outside the pager, so its figures change on a period swap.

            `HeroPour` is the change's motion: on every period swap the card
            fills like a vessel, one rising front carrying net + legend + budget
            into place together. The figures inside therefore pass `roll={false}`
            so a digit-roll doesn't compete with the pour (see `HeroPour`). */}
        <Animated.View style={motionEnabled ? sloshStyle : undefined}>
        <HeroPour
          trigger={periodKey(cursor, granularity)}
          radius={metrics.heroRadius}
          testID="summary-hero-pour"
        >
        <View style={[styles.card, { backgroundColor: colors.deep }]}>
          <Txt variant="microLabel" tone="onDeepMuted">
            {annual ? strings.summary.netThisYear : strings.summary.netThisMonth}
          </Txt>
          <AnimatedNumber
            value={total}
            roll={false}
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
                roll={false}
                format={(n) => (n < 0 ? signed(n, symbol) : yen(n, symbol))}
                variant="inlineAmount"
                tone={remaining < 0 ? 'onDeep' : 'onDeepMuted'}
              />
            </View>
          )}
        </View>
        </HeroPour>
        </Animated.View>

        <Txt variant="microLabel" tone="dim" style={styles.sectionLabel}>
          {strings.summary.spendingByCategory}
        </Txt>

        {/* Remounted on a granularity flip: the pager builds its period window
            once from `shift`, and a month-stepping window cannot be reused as a
            year-stepping one. */}
        <PeriodPager
          key={granularity}
          testID="summary-pager"
          cursor={cursor}
          shift={(ym, delta) => shiftPeriod(ym, delta, granularity)}
          keyOf={(ym) => periodKey(ym, granularity)}
          onCursorChange={onPeriodChange}
          renderPage={(page) => (
            <CategoryList
              entries={entries}
              period={page}
              granularity={granularity}
              budgets={budgets}
              budgetMode={budgetMode}
              symbol={symbol}
              motionEnabled={motionEnabled}
            />
          )}
        />
      </Animated.ScrollView>
    </View>
  );
}

/**
 * One period's ranked expense bars — the paged unit. Takes the *whole* visible
 * ledger and slices it to its own period rather than receiving pre-sliced
 * entries, so a neighbour page renders its own month/year without the host
 * having to compute three breakdowns eagerly on every render.
 */
function CategoryList({
  entries,
  period,
  granularity,
  budgets,
  budgetMode,
  symbol,
  motionEnabled,
}: {
  entries: Transaction[];
  period: YM;
  granularity: SummaryGranularity;
  budgets: Budgets;
  budgetMode: 'category' | 'total';
  symbol: string;
  motionEnabled: boolean;
}) {
  const annual = granularity === 'annual';
  // In total mode, category rows show spend only; in category mode, show
  // per-category budgets. Annual shows neither — see the file header.
  const breakdown = categoryBreakdown(
    periodEntries(entries, period, granularity),
    annual ? {} : budgets,
    budgetMode,
  );

  if (breakdown.length === 0) {
    return (
      <Txt variant="secondary" tone="dim" style={styles.empty}>
        {annual ? strings.summary.noSpendingThisYear : strings.summary.noSpending}
      </Txt>
    );
  }

  return (
    <View>
      {breakdown.map((slice, index) => (
        <Animated.View
          key={slice.category}
          entering={
            motionEnabled
              ? FadeInDown.delay(staggerDelay(index)).reduceMotion(ReduceMotion.Never)
              : undefined
          }
          layout={motionEnabled ? LinearTransition.reduceMotion(ReduceMotion.Never) : undefined}
        >
          <CategoryBar
            category={slice.category}
            total={slice.total}
            fraction={slice.fraction}
            budget={slice.budget}
            symbol={symbol}
          />
        </Animated.View>
      ))}
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
 * so it can hand both to `AnimatedNumber`. It passes `roll={false}` for the same
 * reason the hero net does: on a period swap the whole hero pours in as one
 * front (see `HeroPour`), and these totals ride that front rather than each
 * digit-rolling on its own beat.
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
        roll={false}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitle: { marginTop: 2 },
  granularity: { marginBottom: 20 },
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
