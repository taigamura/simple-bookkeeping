/**
 * CategoryBar — one ranked spending row on Summary: category label + amount on
 * top, a track bar below whose accent fill is scaled to the largest category
 * (`fraction`). The amount reads muted since these are all expenses. A budgeted
 * category (#51) shows "spent / budget" instead, and both fill and amount flip
 * to the amber `warning` accent once spending exceeds the budget: over-budget
 * wants attention, not the red "error" weight reserved for destructive actions
 * (ADR-0002).
 *
 * ## Fill motion
 *
 * The track fill is driven by a shared value holding the 0–1 fraction rather
 * than the static percentage the plain layout used, so it can spring instead
 * of jump: on first mount it grows from 0 up to `fraction` (an entrance, since
 * a bar that simply appears full-width reads as static furniture rather than
 * "your spending"), and on every later change — a month swap, a new entry
 * nudging the ranking — it re-springs to the new width instead of snapping.
 * `springs.gentle` because this is exactly the "larger travel, no visible
 * overshoot" case that spring exists for.
 *
 * The width is expressed as a `${n * 100}%` string built inside the worklet
 * rather than measured and animated in px. Reanimated does not need the string
 * to be worklet-native the way `interpolateColor` output would — it is plain
 * template-literal arithmetic on a UI-thread number, recomputed every frame,
 * and RN's style diffing accepts a percentage string on `width` same as it
 * would from a static style. That keeps the component free of an `onLayout`
 * round trip and a px-based fallback path.
 *
 * The over-budget color flip is deliberately left out of the animated style:
 * it is applied as a plain (non-worklet) style object next to it, so it still
 * switches in a single frame. Red is a warning, and warnings should not ease
 * in — easing a color signals "this is changing," not "this is now wrong."
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { yen, DEFAULT_CURRENCY } from '../domain';
import { useTheme, metrics, springs, useMotion, withAppSpring, Txt } from '../theme';

interface CategoryBarProps {
  category: string;
  total: number;
  /** Bar fill in [0, 1], scaled to the largest category. */
  fraction: number;
  /** The category's monthly budget (#51); omit to render the plain bar. */
  budget?: number;
  symbol?: string;
}

export function CategoryBar({
  category,
  total,
  fraction,
  budget,
  symbol = DEFAULT_CURRENCY.symbol,
}: CategoryBarProps) {
  const { colors } = useTheme();
  const { enabled } = useMotion();
  const overBudget = budget !== undefined && total > budget;
  const clamped = Math.max(0, Math.min(1, fraction));

  // Reduced motion starts (and stays) at the final width; full motion starts
  // at 0 so the first render can grow into place — see file header.
  const progress = useSharedValue(enabled ? 0 : clamped);

  useEffect(() => {
    if (!enabled) {
      progress.value = clamped;
      return;
    }
    progress.value = withAppSpring(clamped, springs.gentle);
    // progress is a stable shared-value ref; only the target and the
    // enabled/disabled switch should re-trigger the spring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, enabled]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Txt variant="listItem" numberOfLines={1} style={styles.label}>
          {category}
        </Txt>
        <Txt variant="inlineAmount" tone={overBudget ? 'warning' : 'muted'}>
          {budget !== undefined
            ? `${yen(total, symbol)} / ${yen(budget, symbol)}`
            : yen(total, symbol)}
        </Txt>
      </View>
      <View style={[styles.track, { backgroundColor: colors.card3 }]}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: overBudget ? colors.warning : colors.positive },
            animatedFillStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, marginBottom: 14 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  label: { flex: 1 },
  track: {
    height: metrics.progressHeight,
    borderRadius: metrics.progressRadius,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: metrics.progressRadius },
});
