/**
 * CalendarScreen — the Calendar home (slice #4). Full month-at-a-glance:
 * header (month+year title over an entry count, ‹ › nav, the dot/number view
 * toggle, ⚙), an In/Out/Net strip bounded by hairlines (plus a BUDGET remaining
 * column once any budget is set, #50), the 7-column month grid, then the
 * selected day's label + net and its entries (or the empty state from the core
 * slice).
 *
 * The title follows the design's two-tone treatment: the month in ink at full
 * weight, the year set back in `dim` at regular weight, so the pair reads as one
 * phrase with the changing part leading.
 *
 * ## Motion
 *
 * Three things animate, all gated on `useMotion()` and all no-ops when it is
 * off:
 *
 * - **The In/Out/Net strip and the selected day's net** roll through
 *   `AnimatedNumber` instead of jumping to the new figure — all four are the
 *   mono `inlineAmount` variant, which is the only variant `AnimatedNumber` is
 *   safe on (see its own file header). `StripCol` used to take a preformatted
 *   string; it now takes the raw number plus the formatter, so the number can
 *   roll rather than the string being replaced whole.
 * - **The title block** ("July 2026" + the entry count) slides ~12px and
 *   cross-fades in the direction the month moved — forward from the right,
 *   back from the left — whenever `y`/`m` change. This is hand-rolled with a
 *   shared value driven from a `useEffect`, not a layout-animation `entering`
 *   preset: the title block never unmounts (there is nothing for `entering` to
 *   attach to), and the direction has to be derived from *which way* the month
 *   moved, which a mount-triggered preset can't express. A ref holds the
 *   previous absolute month index (`y*12+m`, so the December→January turn
 *   compares correctly) purely to compute that direction; it does not gate
 *   whether the animation plays.
 * - **The day list** (the day header + its rows, or the empty state)
 *   cross-fades whenever the selected day or the displayed month changes, so a
 *   day switch and a month swipe both read as a deliberate swap of content
 *   rather than a flash.
 *
 * ## Suito AI one-liners (PRD #145)
 *
 * With the on-device model available and the AI switch on (`ai` prop +
 * `useCalendarAi`), three lines join the screen. None of them moves layout
 * when it arrives:
 *
 * - **Forecast** sits in a fixed one-line slot under the strip. The slot exists
 *   in every month while AI is on (empty outside the current month), so a
 *   month swipe never shifts the grid; the text fades in.
 * - **Day note** sits under the selected day's label. Its slot is reserved as
 *   soon as code finds the day notable (synchronously, inside the day-list
 *   cross-fade), and the model's words fade into it.
 * - **Repeat suggestion** is one row at the top of the day panel (current
 *   month), reserved while the model words it. Accept hands the latest
 *   matching entry to the host to edit with repeat preset to monthly; dismiss
 *   persists the key so it never returns.
 *
 * Without the `ai` prop, or with AI unavailable/off, the screen is exactly
 * the pre-AI layout.
 */
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useCalendarAi, type CalendarAiInput } from '../ai/useCalendarAi';

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
  type CalendarView,
  type RecurrenceDate,
  type Transaction,
  type YM,
} from '../domain';
import { strings } from '../i18n';
import { AnimatedNumber, ListRow, MonthPager, PressScale } from '../ui';
import {
  useTheme,
  metrics,
  mono,
  durations,
  easings,
  useMotion,
  withAppTiming,
  ReduceMotion,
  Txt,
  type Tone,
} from '../theme';
import {
  CalendarViewToggleButton,
  IconButton,
  ThemeToggleButton,
} from '../nav/IconButton';
import type Swipeable from 'react-native-gesture-handler/Swipeable';

/** How far the title block travels on a month swap, in either direction. */
const TITLE_TRAVEL = 12;
/** Small settle for the grid when the Calendar tab is mounted from Summary. */
const GRID_TRAVEL = 14;

/** Suito AI inputs (PRD #145). The host passes the full state (repeat
 *  detection needs history beyond the visible months) and its `updateAi`. */
export interface CalendarAiProps extends CalendarAiInput {
  /** Accept a repeat suggestion: edit `entry` with repeat preset to monthly. */
  onAcceptRepeat: (entry: Transaction) => void;
}

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
  today?: RecurrenceDate;
  symbol: string;
  /** Day-cell variant; the header's toggle flips it through `onToggleView`. */
  view: CalendarView;
  onToggleView: () => void;
  onSelectDay: (day: number) => void;
  /** Tap a day-list row to edit that entry (#43). */
  onEditEntry: (entry: Transaction) => void;
  /** Swipe a day-list row left, then delete it through the existing flow. */
  onDeleteEntry?: (entry: Transaction) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Pager settle: adopt the absolute month it landed on (#48). */
  onMonthChange: (ym: YM) => void;
  onSettings: () => void;
  /** The month (y/m) the landing pulse belongs to, so the pager plays it only
   *  in that month and never replays it when another month scrolls into view. */
  pulseY?: number;
  pulseM?: number;
  /** The day, within `pulseY`/`pulseM`, that should play the landing pulse
   *  after a save — pure pass-through to `MonthPager`. A parent wires these
   *  once saves report back which day they landed on. */
  pulseDay?: number;
  /** Nonce for that pulse — see `DayCell`'s `pulse` prop. */
  pulseNonce?: number;
  /** Suito AI one-liners; absent = no AI surfaces at all. */
  ai?: CalendarAiProps;
}

// Income is the only tinted figure; a negative net is plain ink. Red is
// reserved for destructive actions; over-budget reads as amber `warning`.
const netTone = (n: number): Tone => (n > 0 ? 'positive' : n < 0 ? 'ink' : 'muted');

export function CalendarScreen({
  entries,
  budgets,
  budgetMode,
  totalBudget,
  y,
  m,
  day,
  today,
  symbol,
  view,
  onToggleView,
  onSelectDay,
  onEditEntry,
  onDeleteEntry,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  onSettings,
  pulseY,
  pulseM,
  pulseDay,
  pulseNonce,
  ai,
}: CalendarScreenProps) {
  const { colors } = useTheme();
  const { enabled } = useMotion();
  const openSwipeable = useRef<Swipeable | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const month = monthEntries(entries, { y, m });
  const rows = dayEntries(month, day);
  const dNet = dayNet(month, day);
  // Mode-aware budget logic: check if any budget is active and calculate remaining.
  const budgetActive = isBudgetActive(budgetMode, budgets, totalBudget);
  const remaining = getRemainingBudget(budgetMode, budgets, totalBudget, month);
  const lines = useCalendarAi(ai ?? null, { y, m, day });
  const lineEntering = enabled ? FadeIn.duration(durations.base).reduceMotion(ReduceMotion.Never) : undefined;

  // Title block direction cue: which way the displayed month moved, derived
  // from the absolute month index (y*12+m) so the December -> January turn
  // still compares correctly rather than looking like a jump backwards.
  const titleTranslate = useSharedValue(0);
  const titleOpacity = useSharedValue(1);
  const prevMonthIndex = useRef(y * 12 + m);

  useEffect(() => {
    const index = y * 12 + m;
    if (!enabled) {
      titleTranslate.value = 0;
      titleOpacity.value = 1;
      prevMonthIndex.current = index;
      return;
    }
    if (index === prevMonthIndex.current) return;
    const forward = index > prevMonthIndex.current;
    titleTranslate.value = forward ? TITLE_TRAVEL : -TITLE_TRAVEL;
    titleOpacity.value = 0;
    titleTranslate.value = withAppTiming(0, { duration: durations.base, easing: easings.standard });
    titleOpacity.value = withAppTiming(1, { duration: durations.base, easing: easings.standard });
    prevMonthIndex.current = index;
    // titleTranslate/titleOpacity/prevMonthIndex are shared values and a ref,
    // not reactive inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y, m, enabled]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateX: titleTranslate.value }],
  }));

  // Day-list crossfade: any change to the displayed day *or* month swaps the
  // list, so both a day tap and a month swipe read as a deliberate content
  // change instead of a flash.
  const dayListOpacity = useSharedValue(1);
  const prevDayKey = useRef(`${y}-${m}-${day}`);

  useEffect(() => {
    const key = `${y}-${m}-${day}`;
    if (!enabled) {
      dayListOpacity.value = 1;
      prevDayKey.current = key;
      return;
    }
    if (prevDayKey.current === key) return;
    dayListOpacity.value = 0;
    dayListOpacity.value = withAppTiming(1, { duration: durations.base, easing: easings.standard });
    prevDayKey.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y, m, day, enabled]);

  const dayListAnimatedStyle = useAnimatedStyle(() => ({ opacity: dayListOpacity.value }));

  // The pager mounts its measured FlatList one layout pass after the first
  // render. Without a small wrapper animation that implementation detail reads
  // as the dates popping into place when returning from Summary. Animate only
  // compositor-friendly properties so the grid settles as one continuous
  // surface beneath the tab transition.
  const gridTranslate = useSharedValue(enabled ? GRID_TRAVEL : 0);
  const gridOpacity = useSharedValue(enabled ? 0.82 : 1);

  useEffect(() => {
    if (!enabled) {
      gridTranslate.value = 0;
      gridOpacity.value = 1;
      return;
    }
    gridTranslate.value = withAppTiming(0, {
      duration: durations.base,
      easing: easings.standard,
    });
    gridOpacity.value = withAppTiming(1, {
      duration: durations.quick,
      easing: easings.standard,
    });
    // This is a mount-only entrance; the tab host remounts CalendarScreen per
    // tab switch, so month changes should not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gridAnimatedStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
    transform: [{ translateY: gridTranslate.value }],
  }));

  return (
    <View
      style={styles.screen}
      onStartShouldSetResponderCapture={(event) => {
        // The active Delete control lives in the rightmost action zone. It is
        // part of the swipe row, not an outside tap, so do not close it before
        // its confirmation alert is shown.
        if (openSwipeable.current && event.nativeEvent.pageX >= screenWidth - 90) {
          return false;
        }
        openSwipeable.current?.close();
        return false;
      }}
    >
      <View style={styles.header}>
        <Animated.View style={[styles.titleBlock, enabled && titleAnimatedStyle]}>
          <Txt variant="screenTitle">
            {MONTH_NAMES[m]}{' '}
            {/* `faint` is legible only at this size — see Colors.faint. */}
            <Txt variant="screenTitleYear" tone="faint">
              {y}
            </Txt>
          </Txt>
          <Txt variant="screenSubtitle" tone="dim" style={styles.subtitle}>
            {strings.calendar.entriesThisMonth(month.length)}
          </Txt>
        </Animated.View>
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
          {/* Labelled by the view it switches *to*, so the icon and the label
              agree about what a tap does. */}
          <CalendarViewToggleButton view={view} onPress={onToggleView} />
          <ThemeToggleButton />
          <IconButton name="settings" accessibilityLabel={strings.nav.settings} onPress={onSettings} />
        </View>
      </View>

      <View style={[styles.strip, { borderColor: colors.line }]}>
        <StripCol
          label={strings.calendar.in}
          value={income(month)}
          format={(n) => yen(n, symbol)}
          tone="positive"
        />
        <StripCol
          label={strings.calendar.out}
          value={expense(month)}
          format={(n) => yen(n, symbol)}
          tone="ink"
        />
        <StripCol
          label={strings.calendar.net}
          value={monthNet(month)}
          format={(n) => signed(n, symbol)}
          tone="ink"
          strong
        />
        {/* BUDGET column (#50/#66): only exists once any budget is active in the
            current mode, so the strip stays three columns until opted in.
            Remaining is a magnitude while positive; overspend shows the true
            negative (signed, amber `warning`), never clamped to zero. Amber
            rather than red: over-budget wants attention, not the "error" weight
            red carries for destructive actions (ADR-0002). */}
        {budgetActive && (
          <StripCol
            label={strings.calendar.budget}
            value={remaining}
            format={(n) => (n < 0 ? signed(n, symbol) : yen(n, symbol))}
            tone={remaining < 0 ? 'warning' : 'ink'}
          />
        )}
      </View>

      {lines.enabled && (
        <View style={styles.forecastSlot} testID="ai-forecast-slot">
          {lines.forecast !== null && (
            <Animated.View
              entering={lineEntering}
              testID="ai-forecast"
              style={styles.forecastLine}
              accessible
              accessibilityLabel={`${strings.ai.calendar.forecastLabel}: ${lines.forecast}`}
            >
              <Feather name="trending-up" size={12} color={colors.positive} />
              <Txt variant="secondary" tone="muted" numberOfLines={1} style={styles.flex}>
                {lines.forecast}
              </Txt>
            </Animated.View>
          )}
        </View>
      )}

      <Animated.View style={enabled && gridAnimatedStyle}>
        <MonthPager
          entries={entries}
          y={y}
          m={m}
          selectedDay={day}
          today={today}
          view={view}
          pulseY={pulseY}
          pulseM={pulseM}
          pulseDay={pulseDay}
          pulseNonce={pulseNonce}
          onSelectDay={onSelectDay}
          onMonthChange={onMonthChange}
        />
      </Animated.View>

      <Animated.View style={[styles.dayList, enabled && dayListAnimatedStyle]}>
        <View style={[styles.dayHeader, { borderBottomColor: colors.line }]}>
          <View style={styles.dayHeaderRow}>
            <Txt variant="microLabel" tone="muted">
              {dayLabel(y, m, day)}
            </Txt>
            <AnimatedNumber
              value={dNet}
              format={(n) => signed(n, symbol)}
              variant="inlineAmount"
              tone={netTone(dNet)}
            />
          </View>
          {lines.dayNoteExpected && (
            <View style={styles.dayNoteSlot} testID="ai-day-note-slot">
              {lines.dayNote !== null && (
                <Animated.View entering={lineEntering} testID="ai-day-note">
                  <Txt
                    variant="secondary"
                    tone="dim"
                    numberOfLines={2}
                    accessibilityLabel={`${strings.ai.calendar.dayNoteLabel}: ${lines.dayNote}`}
                  >
                    {lines.dayNote}
                  </Txt>
                </Animated.View>
              )}
            </View>
          )}
        </View>

        {lines.repeat && ai && (
          <RepeatSuggestionRow
            text={lines.repeat.text}
            entering={lineEntering}
            onAccept={() => ai.onAcceptRepeat(lines.repeat!.entry)}
            onDismiss={() => lines.dismissRepeat(lines.repeat!.key)}
          />
        )}

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Txt variant="secondary" tone="dim" style={styles.emptyText}>
              {strings.calendar.emptyDay}
            </Txt>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <View style={styles.dayCard}>
              {rows.map((entry, i) => (
                <ListRow
                  key={entry.id}
                  entry={entry}
                  symbol={symbol}
                  first={i === 0}
                  onPress={() => onEditEntry(entry)}
                  onDelete={onDeleteEntry ? () => onDeleteEntry(entry) : undefined}
                  onSwipeableOpen={(swipeable) => {
                    openSwipeable.current?.close();
                    openSwipeable.current = swipeable;
                  }}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

/** One dismissible repeat suggestion (PRD #145). The row is reserved while
 *  the model words it, so the list below never jumps when the text lands. */
function RepeatSuggestionRow({
  text,
  entering,
  onAccept,
  onDismiss,
}: {
  text: string | null;
  entering: React.ComponentProps<typeof Animated.View>['entering'];
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View testID="ai-repeat" style={[styles.repeatRow, { backgroundColor: colors.card }]}>
      <Feather name="repeat" size={14} color={colors.positive} />
      <View style={styles.flex}>
        {text !== null && (
          <Animated.View entering={entering}>
            <Txt
              variant="optionLabel"
              tone="ink"
              numberOfLines={2}
              testID="ai-repeat-text"
              accessibilityLabel={`${strings.ai.calendar.repeatLabel}: ${text}`}
            >
              {text}
            </Txt>
          </Animated.View>
        )}
      </View>
      <PressScale
        scale="control"
        onPress={onAccept}
        testID="ai-repeat-accept"
        accessibilityRole="button"
        accessibilityLabel={strings.ai.calendar.repeatAcceptA11y}
        hitSlop={6}
        style={({ pressed }) => [
          styles.repeatAccept,
          { borderColor: colors.positive, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Txt variant="secondary" tone="positive">
          {strings.ai.calendar.repeatAccept}
        </Txt>
      </PressScale>
      <PressScale
        scale="control"
        onPress={onDismiss}
        testID="ai-repeat-dismiss"
        accessibilityRole="button"
        accessibilityLabel={strings.ai.calendar.repeatDismiss}
        hitSlop={8}
        style={({ pressed }) => [
          styles.repeatClose,
          { backgroundColor: colors.card2, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Feather name="x" size={13} color={colors.muted} />
      </PressScale>
    </View>
  );
}

function StripCol({
  label,
  value,
  format,
  tone,
  strong = false,
}: {
  label: string;
  /** The raw figure — `AnimatedNumber` owns turning it into text, so it can
   *  roll from the previous render's value instead of the string just being
   *  swapped whole. */
  value: number;
  format: (value: number) => string;
  tone: Tone;
  /** Net column: mono 700 rather than the 600 In/Out use (design §3). */
  strong?: boolean;
}) {
  return (
    <View style={styles.stripCol}>
      <Txt variant="microLabel" tone="dim">
        {label}
      </Txt>
      <AnimatedNumber
        value={value}
        format={format}
        variant="inlineAmount"
        tone={tone}
        style={strong ? styles.stripNet : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: metrics.screenPadX, paddingTop: 12 },
  // Top-aligned, not centred: the title is now two lines and the buttons should
  // sit level with the month, not with the middle of the block (design §2).
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  titleBlock: { flexShrink: 1 },
  subtitle: { marginTop: 4 },
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
  // Wraps the day header + rows (or the empty state) so the crossfade covers
  // exactly the content that changes on a day/month swap. `flex: 1` carries
  // forward the space `empty`/the `ScrollView` used to claim as a direct
  // child of `screen`.
  dayList: { flex: 1 },
  dayHeader: {
    marginTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flex: { flex: 1 },
  // Fixed one-line slot: present in every month while AI is on, so the grid
  // never shifts when the forecast lands or the month changes. Pulled up into
  // the strip's bottom margin so it reads as the strip's footnote.
  forecastSlot: { height: 18, marginTop: -8, marginBottom: 8, justifyContent: 'center' },
  forecastLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayNoteSlot: { minHeight: 16, marginTop: 6 },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: metrics.iconTileRadius + 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  repeatAccept: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: metrics.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatClose: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyText: { textAlign: 'center' },
  list: { paddingBottom: 8 },
  dayCard: {
    width: '100%',
    marginTop: 6,
    gap: 6,
    borderRadius: metrics.cardRadius,
    paddingHorizontal: 0,
  },
});
