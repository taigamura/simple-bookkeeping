/**
 * MonthPager — finger-tracking month pager for the calendar grid (#45). Renders
 * prev / current / next month grids in a 3-wide row; only the grid follows the
 * finger horizontally and snaps to the neighbour past a threshold or on a fling
 * (swipe left = next, swipe right = previous). On snap-commit it calls
 * `onPageChange`, letting the parent advance its `y`/`m` cursor (via the tested
 * `shiftMonth`/`clampDay` helpers) — the title, In/Out/Net strip, and day-list
 * live outside this component and simply re-read the new month, they never page.
 *
 * The gesture is scoped to the grid viewport and requires horizontal intent
 * (`activeOffsetX` / `failOffsetY`) so it doesn't fight the day-list's vertical
 * scroll. Until the viewport is measured (and in the jsdom test path, where no
 * layout fires) it renders a single static grid, so no gesture/animation code
 * runs there.
 */
import React, { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { clampDay, monthEntries, shiftMonth, type Transaction, type YM } from '../domain';
import { CalendarGrid } from './CalendarGrid';

interface MonthPagerProps {
  /** The full ledger; each month grid filters it via `monthEntries`. */
  entries: Transaction[];
  y: number;
  m: number;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  /** Commit a page: -1 = previous month, +1 = next month. */
  onPageChange: (delta: -1 | 1) => void;
}

// A slow drag commits once it passes this fraction of the viewport width; a fast
// flick commits regardless of distance once it exceeds this velocity (px/s).
const SWIPE_FRACTION = 0.25;
const FLING_VELOCITY = 500;
const SNAP_MS = 200;

export function MonthPager({
  entries,
  y,
  m,
  selectedDay,
  onSelectDay,
  onPageChange,
}: MonthPagerProps) {
  const [width, setWidth] = useState(0);
  const translateX = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  const cur: YM = { y, m };

  // Runs on the JS thread after the snap animation: recentre the finger offset,
  // then let the parent advance the cursor so the committed month renders in
  // place (the month we just slid to becomes the new centre — no visible jump).
  const commit = (delta: -1 | 1) => {
    translateX.value = 0;
    onPageChange(delta);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = Math.max(-width, Math.min(width, e.translationX));
    })
    .onEnd((e) => {
      const committed =
        width > 0 &&
        (Math.abs(e.translationX) > width * SWIPE_FRACTION ||
          Math.abs(e.velocityX) > FLING_VELOCITY);
      if (committed) {
        const delta: -1 | 1 = e.translationX < 0 ? 1 : -1;
        translateX.value = withTiming(delta === 1 ? -width : width, { duration: SNAP_MS }, (done) => {
          if (done) runOnJS(commit)(delta);
        });
      } else {
        translateX.value = withTiming(0, { duration: 180 });
      }
    });

  // The 3-wide row is offset by -width so the current month sits centred; the
  // finger delta rides on top of that base offset.
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - width }],
  }));

  // Pre-measurement (and the test path): one static grid, no gesture/animation.
  if (width === 0) {
    return (
      <View onLayout={onLayout}>
        <CalendarGrid
          y={y}
          m={m}
          monthEntries={monthEntries(entries, cur)}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
      </View>
    );
  }

  const pages: { ym: YM; onSelect: (day: number) => void }[] = [
    { ym: shiftMonth(cur, -1), onSelect: () => {} },
    { ym: cur, onSelect: onSelectDay },
    { ym: shiftMonth(cur, 1), onSelect: () => {} },
  ];

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, { width: width * 3 }, rowStyle]}>
          {pages.map(({ ym, onSelect }) => (
            <View key={`${ym.y}-${ym.m}`} style={{ width }}>
              <CalendarGrid
                y={ym.y}
                m={ym.m}
                monthEntries={monthEntries(entries, ym)}
                // Neighbours preview the carried-over selection, clamped in-range.
                selectedDay={clampDay(selectedDay, ym.y, ym.m)}
                onSelectDay={onSelect}
              />
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  // Clip the off-screen neighbour grids to the current month's column.
  viewport: { overflow: 'hidden' },
  row: { flexDirection: 'row' },
});
