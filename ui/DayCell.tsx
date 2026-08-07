/**
 * DayCell — one day in the month grid, in either of the design's two variants.
 *
 * `dots` (the default) marks an active day with a single dot whose color and
 * size carry the day's shape: income is the accent blue at full strength,
 * expense is ink held back, and a heavy spending day grows the dot. It reads as
 * a density map of the month and, unlike a number, cannot truncate at seven
 * columns of phone width.
 *
 * `numbers` prints the signed net instead, in the tiny mono style: income in
 * the accent blue, expense in plain ink so a month of spending reads as one
 * calm surface rather than a wall of red.
 *
 * Both variants announce the same net to screen readers, so the choice is
 * purely visual. Non-selected cells sit on the card fill; the selected day is a
 * solid accent tile. Empty days read as just the number.
 *
 * ## Motion
 *
 * Four independent things animate here, each gated on `useMotion()` and each
 * a no-op (exactly today's static render) when motion is off:
 *
 * 1. **Selection arrival.** The cell scales 1 → ~1.06 → 1 (`springs.snap`) and
 *    the accent tile fades in as a separate absolutely-positioned fill layer
 *    behind the content, rather than swapping the Pressable's own
 *    `backgroundColor`. Two chained `withSpring` calls do the bounce, not
 *    `withSequence` — the jest mock resolves `withSequence` to a bare `0`,
 *    which would leave the cell scaled to nothing instead of settled at 1 (see
 *    `theme/motion.ts`). The disabled path keeps the original direct
 *    `backgroundColor` swap on the Pressable itself, which is also why the
 *    render tree forks on `enabled` rather than merely zeroing durations.
 * 2. **The dot.** It springs in (`springs.snap`) the moment a day gains its
 *    first activity, and springs between `metrics.dayDot` and
 *    `metrics.dayDotLarge` when a day crosses `HEAVY_DAY`, rather than jumping
 *    size on the frame the net crosses the line.
 * 3. **The landing pulse** (`pulse` prop): a nonce a parent bumps after a save
 *    lands on this day. A bordered accent ring scales 1 → ~1.5 while fading
 *    0.7 → 0 (`springs.pop`, matching the app's one deliberately bouncy
 *    spring) — the confirmation that the entry landed *here*. Both the ring's
 *    scale and its opacity are driven off one shared progress value instead of
 *    two independently-timed animations, so they can never land visibly out of
 *    step, and so the synchronous jest-mock resolution of `withSpring` lands
 *    the ring fully faded rather than stuck mid-pulse.
 * 4. **View changes.** The number and dot occupy one fixed-height stage and
 *    crossfade/scale over 200ms. Both stay mounted while motion is enabled, so
 *    a second tap retargets one live progress value without moving the grid.
 */
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { signed, type CalendarView } from '../domain';
import { strings } from '../i18n';
import {
  useTheme,
  metrics,
  durations,
  easings,
  springs,
  useMotion,
  withAppSpring,
  withAppTiming,
  Txt,
} from '../theme';

/**
 * Expense magnitude at or above which the dot steps up a size. One fixed
 * threshold rather than a scale relative to the month: a heavy day should look
 * heavy on its own terms, not merely heavier than its neighbours. Currency is
 * symbol-swap only (no FX), so this is a single number in whatever unit the
 * ledger is kept.
 */
export const HEAVY_DAY = 5000;

interface DayCellProps {
  day: number;
  /** Signed daily net; 0 renders no amount line. */
  net: number;
  selected: boolean;
  /** The real current date, independently outlined when it is not selected. */
  today?: boolean;
  /** Which variant to render; defaults to the design's dot variant. */
  view?: CalendarView;
  /**
   * A nonce: bump to a new non-zero value to play the one-shot landing pulse
   * (a just-saved entry landed on this day). Repeating the same value —
   * including staying at the same number across renders — plays nothing,
   * which is why the caller must mint a fresh number per save rather than
   * reuse a boolean.
   */
  pulse?: number;
  onPress: (day: number) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function DayCell(props: DayCellProps) {
  const { enabled } = useMotion();

  // Keep the host component stable for the lifetime of a cell. Switching an
  // empty day from StaticDayCell to AnimatedDayCell precisely when it became
  // selected tore down and recreated the native pressable while Reanimated was
  // attaching its selection worklets. iOS can abort in that handoff. Motion is
  // a session-level preference, so choosing the implementation from `enabled`
  // keeps date taps on one native tree without changing reduced-motion output.
  return enabled ? <AnimatedDayCell {...props} /> : <StaticDayCell {...props} />;
}

function StaticDayCell({
  day,
  net,
  selected,
  today = false,
  view = 'dots',
  onPress,
}: DayCellProps) {
  const { colors } = useTheme();
  const hasNet = net !== 0;
  const income = net > 0;
  const netTone = income ? 'positive' : 'ink';
  const heavy = !income && Math.abs(net) >= HEAVY_DAY;
  const dotSize = heavy ? metrics.dayDotLarge : metrics.dayDot;
  const dotColor = selected ? colors.onPositive : income ? colors.positive : colors.ink;
  const dotOpacity = selected ? 0.85 : income ? 1 : heavy ? 0.65 : 0.3;
  const netText = signed(net, '');

  return (
    <Pressable
      onPress={() => onPress(day)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={strings.calendar.dayAccessibilityLabel(day)}
      accessibilityValue={
        hasNet
          ? { text: strings.calendar.dayNetAccessibilityValue(netText) }
          : undefined
      }
      style={[
        styles.cell,
        { backgroundColor: selected ? colors.positive : colors.card },
        today && !selected && { borderWidth: 1.5, borderColor: colors.positive },
      ]}
    >
      <Txt variant="calendarDay" tone={selected ? 'onPositive' : 'ink'}>
        {day}
      </Txt>
      {hasNet &&
        (view === 'dots' ? (
          <View
            testID={`day-dot-${day}`}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: metrics.pill,
              backgroundColor: dotColor,
              opacity: dotOpacity,
            }}
          />
        ) : (
          <Txt
            variant="calendarDayTotal"
            tone={selected ? 'onPositive' : netTone}
            style={selected ? styles.selectedTotal : undefined}
            numberOfLines={1}
          >
            {netText}
          </Txt>
        ))}
    </Pressable>
  );
}

function AnimatedDayCell({
  day,
  net,
  selected,
  today = false,
  view = 'dots',
  pulse,
  onPress,
}: DayCellProps) {
  const { colors } = useTheme();
  const { enabled } = useMotion();
  const hasNet = net !== 0;
  // Income is the only tinted total; expense stays ink (see file header).
  const income = net > 0;
  const netTone = income ? 'positive' : 'ink';
  const netText = signed(net, '');
  const heavy = !income && Math.abs(net) >= HEAVY_DAY;

  // On the accent tile the dot flips to the on-accent color; otherwise income
  // keeps the accent at full strength and expense is a held-back ink mark.
  const dotSize = heavy ? metrics.dayDotLarge : metrics.dayDot;
  const dotColor = selected ? colors.onPositive : income ? colors.positive : colors.ink;
  const dotOpacity = selected ? 0.85 : income ? 1 : heavy ? 0.65 : 0.3;

  const scale = useSharedValue(1);
  const fill = useSharedValue(selected ? 1 : 0);
  const dotScale = useSharedValue(hasNet ? 1 : 0);
  const dotSizeSV = useSharedValue(dotSize);
  const pulseProgress = useSharedValue(0);
  const viewProgress = useSharedValue(view === 'dots' ? 1 : 0);

  const prevSelected = useRef(selected);
  const prevHasNet = useRef(hasNet);
  const prevPulse = useRef(pulse);

  // Selection arrival: fade the fill layer always; bounce the scale only on
  // the false -> true edge (re-selecting the same day, or a re-render for an
  // unrelated prop change, should not re-play the bounce).
  useEffect(() => {
    if (!enabled) {
      fill.value = selected ? 1 : 0;
      scale.value = 1;
      prevSelected.current = selected;
      return;
    }
    fill.value = withAppTiming(selected ? 1 : 0, {
      duration: durations.quick,
      easing: easings.standard,
    });
    if (selected && !prevSelected.current) {
      scale.value = withAppSpring(1.06, springs.snap, (finished) => {
        'worklet';
        if (finished) scale.value = withAppSpring(1, springs.snap);
      });
    }
    prevSelected.current = selected;
    // fill/scale/prevSelected are refs/shared values, not reactive inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, enabled]);

  // The dot's scale-in plays only on the no-activity -> activity edge; a day
  // that already has activity re-rendering (e.g. the month simply re-painting)
  // should not replay the spring.
  useEffect(() => {
    if (!enabled) {
      dotScale.value = hasNet ? 1 : 0;
      prevHasNet.current = hasNet;
      return;
    }
    if (hasNet && !prevHasNet.current) {
      dotScale.value = 0;
      dotScale.value = withAppSpring(1, springs.snap);
    } else if (!hasNet) {
      dotScale.value = 0;
    }
    prevHasNet.current = hasNet;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNet, enabled]);

  // The size spring: every render re-targets dotSizeSV at the current
  // dotSize, so crossing HEAVY_DAY in either direction (a day's net moving
  // above or back below the threshold) springs rather than jumps.
  useEffect(() => {
    if (!enabled) {
      dotSizeSV.value = dotSize;
      return;
    }
    dotSizeSV.value = withAppSpring(dotSize, springs.snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dotSize, enabled]);

  // Numbers and dots occupy one fixed slot. Retargeting this single progress
  // value reverses cleanly from the current frame when the toggle is tapped
  // again before the 200ms crossfade settles.
  useEffect(() => {
    const target = view === 'dots' ? 1 : 0;
    viewProgress.value = enabled
      ? withAppTiming(target, {
          duration: durations.symbolSwap,
          easing: easings.inOut,
        })
      : target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, enabled]);

  // Landing pulse: only a *new* non-zero nonce plays it, so a re-render that
  // merely carries the same nonce forward (or a day with no nonce at all)
  // stays silent.
  useEffect(() => {
    if (!enabled || !pulse || pulse === prevPulse.current) {
      prevPulse.current = pulse;
      return;
    }
    prevPulse.current = pulse;
    pulseProgress.value = 0;
    pulseProgress.value = withAppSpring(1, springs.pop, (finished) => {
      'worklet';
      if (finished) pulseProgress.value = 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse, enabled]);

  const cellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const fillAnimatedStyle = useAnimatedStyle(() => ({ opacity: fill.value }));
  const dotAnimatedStyle = useAnimatedStyle(() => ({
    width: dotSizeSV.value,
    height: dotSizeSV.value,
    transform: [{ scale: dotScale.value }],
  }));
  const dotViewStyle = useAnimatedStyle(() => ({
    opacity: viewProgress.value,
    transform: [{ scale: 0.9 + viewProgress.value * 0.1 }],
  }));
  const numberViewStyle = useAnimatedStyle(() => ({
    opacity: 1 - viewProgress.value,
    transform: [{ scale: 1 - viewProgress.value * 0.1 }],
  }));
  // 0 -> 1 progress maps onto both the ring's grow (1 -> 1.5 scale) and its
  // fade (0.7 -> 0 opacity) in one pass — see file header.
  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - pulseProgress.value),
    transform: [{ scale: 1 + pulseProgress.value * 0.5 }],
  }));

  const a11yProps = {
    accessibilityRole: 'button' as const,
    accessibilityState: { selected },
    accessibilityLabel: strings.calendar.dayAccessibilityLabel(day),
    accessibilityValue: hasNet
      ? { text: strings.calendar.dayNetAccessibilityValue(netText) }
      : undefined,
  };

  const indicatorNode = hasNet && (
    <View style={styles.indicatorSlot} pointerEvents="none">
      <Animated.View style={[styles.indicatorLayer, dotViewStyle]}>
        <Animated.View
          testID={view === 'dots' ? `day-dot-${day}` : undefined}
          style={[
            { borderRadius: metrics.pill, backgroundColor: dotColor, opacity: dotOpacity },
            dotAnimatedStyle,
          ]}
        />
      </Animated.View>
      <Animated.View style={[styles.indicatorLayer, numberViewStyle]}>
        <Txt
          variant="calendarDayTotal"
          tone={selected ? 'onPositive' : netTone}
          style={selected ? styles.selectedTotal : undefined}
          numberOfLines={1}
        >
          {/* compact signed net, no currency symbol, to fit the cell */}
          {netText}
        </Txt>
      </Animated.View>
    </View>
  );

  if (!enabled) {
    return (
      <Pressable
        onPress={() => onPress(day)}
        {...a11yProps}
        style={[
          styles.cell,
          { backgroundColor: selected ? colors.positive : colors.card },
          today && !selected && { borderWidth: 1.5, borderColor: colors.positive },
        ]}
      >
        <Txt variant="calendarDay" tone={selected ? 'onPositive' : 'ink'}>
          {day}
        </Txt>
        {indicatorNode}
      </Pressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={() => onPress(day)}
      {...a11yProps}
      style={[
        styles.cell,
        { backgroundColor: colors.card },
        today && !selected && { borderWidth: 1.5, borderColor: colors.positive },
        cellAnimatedStyle,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          { backgroundColor: colors.positive, borderRadius: metrics.dayCellRadius },
          fillAnimatedStyle,
        ]}
      />
      <Txt variant="calendarDay" tone={selected ? 'onPositive' : 'ink'}>
        {day}
      </Txt>
      {indicatorNode}
      {pulse != null && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { borderColor: colors.positive, borderRadius: metrics.dayCellRadius },
            ringAnimatedStyle,
          ]}
        />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    height: metrics.dayCellHeight,
    borderRadius: metrics.dayCellRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  /** Slightly recessive against the accent tile so the day number leads. */
  selectedTotal: { opacity: 0.75 },
  /** Fixed symbol stage: numbers and dots trade opacity/scale without changing
   * the day cell's measured layout or nudging the grid. */
  indicatorSlot: { width: '100%', height: 10, position: 'relative' },
  indicatorLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The accent fill layer: sized to exactly cover the cell, behind the
   *  content, faded in/out instead of swapping the Pressable's own
   *  `backgroundColor` — see file header. */
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /** The landing-pulse ring: inset just outside the cell edge so it reads as
   *  a halo rather than a second border sharing the cell's own edge. */
  ring: { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderWidth: 1.5 },
});
