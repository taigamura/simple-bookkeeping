/**
 * PeriodPager — the native paged-period scroller behind both the Calendar's
 * month grid (#48) and the Summary screen's category list.
 *
 * This is `MonthPager` generalised. That component's paging machinery — the
 * growing window, the settle-on-momentum-end commit, the `scrollToIndex` follow
 * for external cursor moves, the iOS double-report coalescing, the
 * pre-measurement static fallback — turned out to be entirely independent of
 * *what* a page draws or of how wide a period is. Summary needs all of it, and
 * needs it to step a year at a time in annual mode, so the mechanics moved here
 * behind two injected functions (`shift`, `keyOf`) and `renderPage`.
 *
 * A horizontal `FlatList` with `pagingEnabled` renders a window of periods, so
 * snapping, momentum, and rapid successive flings are handled by the native
 * scroll view (the custom pan-gesture pager they replaced ate fast flings and
 * flashed on settle). `disableIntervalMomentum` keeps one fling = exactly one
 * period, by design.
 *
 * The cursor commits when scroll momentum ends: `onCursorChange` reports the
 * absolute period the list settled on (after rapid flings that can be several
 * periods from the last commit — a delta would drift). Anything living outside
 * the pager re-reads the new period at that commit, so it swaps exactly at
 * snap-end, never mid-animation. External cursor moves (the Calendar header's
 * ‹ › chevrons, a granularity flip) slide the list via `scrollToIndex`.
 *
 * The window starts at ±WINDOW_RADIUS periods and grows by WINDOW_CHUNK when a
 * settle lands within WINDOW_EDGE pages of an end; `maintainVisibleContentPosition`
 * keeps the viewport still when periods are prepended. Until the viewport is
 * measured (and in the jsdom test path, where no layout fires) it renders a
 * single static page, so no scroll code runs there.
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

import type { YM } from '../domain';

interface PeriodPagerProps {
  /** The period currently committed — the page the list centres on. */
  cursor: YM;
  /** Move a period by `delta` whole steps: a month, a year, whatever paginates. */
  shift: (ym: YM, delta: number) => YM;
  /** Stable identity for a period; also the FlatList key. */
  keyOf: (ym: YM) => string;
  /** One page. `isCursor` is false for the off-screen neighbours, which must
   *  not take input aimed at the committed period. */
  renderPage: (ym: YM, isCursor: boolean) => React.ReactNode;
  /** Commit the absolute period the pager settled on. */
  onCursorChange: (ym: YM) => void;
  testID?: string;
}

// Initial window half-width; a settle within WINDOW_EDGE pages of an end grows
// the window by WINDOW_CHUNK periods on that side.
const WINDOW_RADIUS = 12;
const WINDOW_EDGE = 3;
const WINDOW_CHUNK = 12;

/** Build a period window spanning `radius` steps either side of `center`. */
export function buildPeriodWindow(
  center: YM,
  radius: number,
  shift: (ym: YM, delta: number) => YM,
): YM[] {
  const periods: YM[] = [];
  for (let delta = -radius; delta <= radius; delta++) periods.push(shift(center, delta));
  return periods;
}

/** The page a settled scroll offset lands on, clamped into the window. */
export function pageIndex(offsetX: number, width: number, pageCount: number): number {
  return Math.max(0, Math.min(pageCount - 1, Math.round(offsetX / width)));
}

export function PeriodPager({
  cursor,
  shift,
  keyOf,
  renderPage,
  onCursorChange,
  testID = 'period-pager',
}: PeriodPagerProps) {
  const [width, setWidth] = useState(0);
  const [periods, setPeriods] = useState<YM[]>(() =>
    buildPeriodWindow(cursor, WINDOW_RADIUS, shift),
  );
  // Remount the list (re-applying `initialScrollIndex`) when the window is
  // rebuilt around a far-off cursor jump initiated by the host.
  const [generation, setGeneration] = useState(0);

  const listRef = useRef<FlatList<YM>>(null);
  const pendingScrollIndex = useRef<number | null>(null);
  const periodsRef = useRef(periods);
  periodsRef.current = periods;
  // The period this pager currently shows — the last settle it committed or the
  // last external cursor move it followed.
  const shownRef = useRef<YM>(cursor);
  // iOS can report both `onScrollEndDrag` and `onMomentumScrollEnd` for the
  // same page. Coalescing that report prevents a second scroll/commit cycle
  // while the chevron animation is still settling.
  const lastSettledOffset = useRef<number | null>(null);
  // `shift`/`keyOf` are read from refs inside effects and callbacks so that a
  // host passing fresh closures every render (the common case) does not
  // re-trigger the cursor-follow effect and fight the user's own scrolling.
  const shiftRef = useRef(shift);
  shiftRef.current = shift;
  const keyRef = useRef(keyOf);
  keyRef.current = keyOf;

  const sameKey = (a: YM, b: YM) => keyRef.current(a) === keyRef.current(b);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  // External cursor moves (‹ › chevrons, a granularity flip, other host
  // navigation): slide to the new period, or rebuild the window around it when
  // it falls outside. Keyed on the cursor's *identity string* rather than the
  // object, so a host re-rendering with an equal-but-new `{y, m}` is a no-op.
  const cursorKey = keyOf(cursor);
  useEffect(() => {
    if (sameKey(cursor, shownRef.current)) return;
    shownRef.current = cursor;
    lastSettledOffset.current = null;
    const index = periodsRef.current.findIndex((period) => sameKey(period, cursor));
    if (index === -1) {
      setPeriods(buildPeriodWindow(cursor, WINDOW_RADIUS, shiftRef.current));
      setGeneration((g) => g + 1);
    } else {
      pendingScrollIndex.current = index;
      listRef.current?.scrollToIndex({ index, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorKey]);

  // iOS can deliver an external cursor update before the newly mounted list
  // has calculated its frames. Calling scrollToIndex in that window reports
  // `onScrollToIndexFailed`; retry after the list has had a layout pass instead
  // of allowing the native list to abort the period switch.
  const onScrollToIndexFailed = ({ index }: { index: number }) => {
    pendingScrollIndex.current = index;
    requestAnimationFrame(() => {
      const pending = pendingScrollIndex.current;
      if (pending == null) return;
      pendingScrollIndex.current = null;
      listRef.current?.scrollToIndex({ index: pending, animated: true });
    });
  };

  // settle(): map the settled offset to a period, commit it if it moved, and
  // grow the window when the settle lands near an edge (prepends stay visually
  // still via maintainVisibleContentPosition).
  const settle = (offsetX: number) => {
    if (width <= 0 || !Number.isFinite(offsetX)) return;
    const page = Math.round(offsetX / width);
    const settledOffset = page * width;
    if (lastSettledOffset.current === settledOffset) return;
    lastSettledOffset.current = settledOffset;
    const window = periodsRef.current;
    const index = pageIndex(settledOffset, width, window.length);
    const period = window[index];
    if (!period) return;
    if (!sameKey(period, shownRef.current)) {
      shownRef.current = period;
      onCursorChange(period);
    }
    if (index <= WINDOW_EDGE) {
      const first = window[0];
      const prefix = Array.from({ length: WINDOW_CHUNK }, (_, i) =>
        shiftRef.current(first, i - WINDOW_CHUNK),
      );
      setPeriods([...prefix, ...window]);
    } else if (index >= window.length - 1 - WINDOW_EDGE) {
      const last = window[window.length - 1];
      const suffix = Array.from({ length: WINDOW_CHUNK }, (_, i) =>
        shiftRef.current(last, i + 1),
      );
      setPeriods([...window, ...suffix]);
    }
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    settle(e.nativeEvent.contentOffset.x);

  // Touch-catch case: stopping the deceleration dead on a page boundary ends
  // the drag with no momentum phase, so momentum-end never fires.
  const onScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (width > 0 && Math.abs(x / width - Math.round(x / width)) < 0.01) settle(x);
  };

  // Pre-measurement (and the test path): one static page, no scroll code.
  if (width === 0) {
    return (
      <View testID={testID} onLayout={onLayout}>
        {renderPage(cursor, true)}
      </View>
    );
  }

  const initialIndex = Math.max(
    0,
    periods.findIndex((period) => sameKey(period, shownRef.current)),
  );

  return (
    <View testID={testID} style={styles.viewport} onLayout={onLayout}>
      <FlatList
        ref={listRef}
        key={`${width}-${generation}`}
        testID={`${testID}-list`}
        data={periods}
        keyExtractor={keyOf}
        renderItem={({ item }) => (
          <View style={{ width }}>{renderPage(item, sameKey(item, cursor))}</View>
        )}
        horizontal
        pagingEnabled
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        initialScrollIndex={initialIndex}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScrollBeginDrag={() => {
          lastSettledOffset.current = null;
        }}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onScrollEndDrag}
        onScrollToIndexFailed={onScrollToIndexFailed}
        // The hosting tab is mounted during a tab transition. Keep the first
        // frame cheap: the current period is all that is needed immediately;
        // neighbours can be filled in after the first paint instead of making
        // three full pages compete with the entrance animation.
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Clip the off-screen neighbour pages to the current period's column.
  viewport: { overflow: 'hidden' },
});
