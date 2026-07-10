/**
 * MonthPager — native paged month list for the calendar grid (#48). A
 * horizontal `FlatList` with `pagingEnabled` renders a window of months, so
 * snapping, momentum, and rapid successive flings are handled by the native
 * scroll view (the custom pan-gesture pager they replace ate fast flings and
 * flashed on settle). `disableIntervalMomentum` keeps one fling = exactly one
 * month, by design.
 *
 * The month cursor commits when scroll momentum ends: `onMonthChange` reports
 * the absolute month the list settled on (after rapid flings that can be
 * several months from the last commit — a delta would drift). The title,
 * In/Out/Net strip, and day-list live outside this component and re-read the
 * new month at that commit, so they swap exactly at snap-end, never
 * mid-animation. External cursor moves (the header's ‹ › chevrons) slide the
 * list to the new month via `scrollToIndex`.
 *
 * The window starts at ±WINDOW_RADIUS months and grows by WINDOW_CHUNK when a
 * settle lands within WINDOW_EDGE pages of an end; `maintainVisibleContentPosition`
 * keeps the viewport still when months are prepended. Until the viewport is
 * measured (and in the jsdom test path, where no layout fires) it renders a
 * single static grid, so no scroll code runs there.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View,
} from 'react-native';

import { clampDay, monthEntries, shiftMonth, type Transaction, type YM } from '../domain';
import { CalendarGrid } from './CalendarGrid';

interface MonthPagerProps {
  /** The full ledger; each month grid filters it via `monthEntries`. */
  entries: Transaction[];
  y: number;
  m: number;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  /** Commit the absolute month the pager settled on. */
  onMonthChange: (ym: YM) => void;
}

// Initial window half-width; a settle within WINDOW_EDGE pages of an end grows
// the window by WINDOW_CHUNK months on that side.
const WINDOW_RADIUS = 12;
const WINDOW_EDGE = 3;
const WINDOW_CHUNK = 12;

/** Build a month window spanning `radius` months either side of `center`. */
export function buildWindow(center: YM, radius: number): YM[] {
  const months: YM[] = [];
  for (let delta = -radius; delta <= radius; delta++) months.push(shiftMonth(center, delta));
  return months;
}

/** The page a settled scroll offset lands on, clamped into the window. */
export function pageIndex(offsetX: number, width: number, pageCount: number): number {
  return Math.max(0, Math.min(pageCount - 1, Math.round(offsetX / width)));
}

const sameYM = (a: YM, b: YM) => a.y === b.y && a.m === b.m;

export function MonthPager({
  entries,
  y,
  m,
  selectedDay,
  onSelectDay,
  onMonthChange,
}: MonthPagerProps) {
  const [width, setWidth] = useState(0);
  const [months, setMonths] = useState<YM[]>(() => buildWindow({ y, m }, WINDOW_RADIUS));
  // Remount the list (re-applying `initialScrollIndex`) when the window is
  // rebuilt around a far-off cursor jump, e.g. loading the sample data.
  const [generation, setGeneration] = useState(0);

  const listRef = useRef<FlatList<YM>>(null);
  const monthsRef = useRef(months);
  monthsRef.current = months;
  // The month this pager currently shows — the last settle it committed or the
  // last external cursor move it followed.
  const shownRef = useRef<YM>({ y, m });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  // External cursor moves (‹ › chevrons, sample-data jump): slide to the new
  // month, or rebuild the window around it when it falls outside.
  useEffect(() => {
    const cur: YM = { y, m };
    if (sameYM(cur, shownRef.current)) return;
    shownRef.current = cur;
    const index = monthsRef.current.findIndex((ym) => sameYM(ym, cur));
    if (index === -1) {
      setMonths(buildWindow(cur, WINDOW_RADIUS));
      setGeneration((g) => g + 1);
    } else {
      listRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [y, m]);

  // settle(): map the settled offset to a month, commit it if it moved, and
  // grow the window when the settle lands near an edge (prepends stay visually
  // still via maintainVisibleContentPosition).
  const settle = (offsetX: number) => {
    const window = monthsRef.current;
    const index = pageIndex(offsetX, width, window.length);
    const ym = window[index];
    if (!sameYM(ym, shownRef.current)) {
      shownRef.current = ym;
      onMonthChange(ym);
    }
    if (index <= WINDOW_EDGE) {
      const first = window[0];
      const prefix = Array.from({ length: WINDOW_CHUNK }, (_, i) =>
        shiftMonth(first, i - WINDOW_CHUNK),
      );
      setMonths([...prefix, ...window]);
    } else if (index >= window.length - 1 - WINDOW_EDGE) {
      const last = window[window.length - 1];
      const suffix = Array.from({ length: WINDOW_CHUNK }, (_, i) => shiftMonth(last, i + 1));
      setMonths([...window, ...suffix]);
    }
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    settle(e.nativeEvent.contentOffset.x);

  // Touch-catch case: stopping the deceleration dead on a page boundary ends
  // the drag with no momentum phase, so momentum-end never fires.
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (width > 0 && x % width === 0) settle(x);
  };

  // Pre-measurement (and the test path): one static grid, no scroll code.
  if (width === 0) {
    return (
      <View testID="month-pager" onLayout={onLayout}>
        <CalendarGrid
          y={y}
          m={m}
          monthEntries={monthEntries(entries, { y, m })}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
        />
      </View>
    );
  }

  const initialIndex = Math.max(
    0,
    months.findIndex((ym) => sameYM(ym, shownRef.current)),
  );

  return (
    <View testID="month-pager" style={styles.viewport} onLayout={onLayout}>
      <FlatList
        ref={listRef}
        key={`${width}-${generation}`}
        testID="month-pager-list"
        data={months}
        keyExtractor={(ym) => `${ym.y}-${ym.m}`}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <CalendarGrid
              y={item.y}
              m={item.m}
              monthEntries={monthEntries(entries, item)}
              // Neighbours preview the carried-over selection, clamped in-range;
              // only the committed month's grid takes day taps.
              selectedDay={clampDay(selectedDay, item.y, item.m)}
              onSelectDay={sameYM(item, { y, m }) ? onSelectDay : () => {}}
            />
          </View>
        )}
        horizontal
        pagingEnabled
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        initialScrollIndex={initialIndex}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Clip the off-screen neighbour grids to the current month's column.
  viewport: { overflow: 'hidden' },
});
