/**
 * SplitBar — the in/out proportion bar on the Summary net card. A single fully
 * rounded track split into an income and an expense segment sized by their
 * share of the combined flow. An empty month renders as a bare track.
 *
 * The Summary card is the saturated `deep` hero block, so the bar has an
 * on-deep treatment (`onDeep`): white for income, a translucent white for
 * expense, over a dimmed white track. Off the hero it uses the accent and a
 * muted ink for expense — red is reserved for things that are wrong.
 *
 * ## Rebalancing motion
 *
 * `incomeFraction`/`expenseFraction` always sum to 1 when there is any flow
 * (or are both 0 for the bare-track case — see `domain/summary.ts`), so unlike
 * `CategoryBar` this never needs a scaled-to-the-max fraction, just the two
 * numbers converted straight to widths. The original layout sized the two
 * segments with `flex`, which animates badly: reanimated has no clean way to
 * spring a `flex` value, since flex is resolved by the layout engine rather
 * than being a simple animatable style property, so the two segments were
 * dropped in favour of percentage `width`s driven by shared values. Each
 * segment gets its own shared value rather than one shared "split point",
 * because the segments are two independent widths, not a single divider
 * position — deriving one from the other would tie their spring timing
 * together for no benefit.
 *
 * Both spring on every prop change with `springs.gentle`, matching
 * `CategoryBar`'s "larger travel, no overshoot" case. On first mount they grow
 * from zero so the split bar reads as part of the Summary entrance rather than
 * static furniture; later month swaps spring from the current widths.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useTheme, metrics, springs, useMotion, withAppSpring } from '../theme';

interface SplitBarProps {
  incomeFraction: number;
  expenseFraction: number;
  /** Render for placement on the `deep` hero block. */
  onDeep?: boolean;
}

export function SplitBar({ incomeFraction, expenseFraction, onDeep = false }: SplitBarProps) {
  const { colors } = useTheme();
  const { enabled } = useMotion();
  const track = onDeep ? 'rgba(255,255,255,.20)' : colors.card3;
  const income = onDeep ? colors.onDeep : colors.positive;
  const expense = onDeep ? 'rgba(255,255,255,.42)' : colors.muted;

  const incomeProgress = useSharedValue(enabled ? 0 : incomeFraction);
  const expenseProgress = useSharedValue(enabled ? 0 : expenseFraction);

  useEffect(() => {
    if (!enabled) {
      incomeProgress.value = incomeFraction;
      expenseProgress.value = expenseFraction;
      return;
    }
    incomeProgress.value = withAppSpring(incomeFraction, springs.gentle);
    expenseProgress.value = withAppSpring(expenseFraction, springs.gentle);
    // The two shared values are stable refs; only the incoming fractions and
    // the enabled/disabled switch should re-trigger a spring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeFraction, expenseFraction, enabled]);

  const incomeStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, incomeProgress.value) * 100}%`,
    backgroundColor: income,
  }));
  const expenseStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, expenseProgress.value) * 100}%`,
    backgroundColor: expense,
  }));

  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={incomeStyle} />
      <Animated.View style={expenseStyle} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: metrics.progressHeight,
    borderRadius: metrics.progressRadius,
    overflow: 'hidden',
  },
});
