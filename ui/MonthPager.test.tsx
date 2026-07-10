/**
 * MonthPager test (#45, #48). Native scroll feel is verified on-device, so this
 * covers the pager's two jsdom-testable contracts:
 *
 * 1. Static render — before the viewport is measured (the jsdom path, where no
 *    layout event fires) the pager renders a single static grid for the current
 *    month (7-column weeks), so the calendar is fully usable via the ‹ ›
 *    chevrons with no scroll code exercised.
 * 2. Page commit — once measured, a settled scroll offset commits the absolute
 *    month at that page via `onMonthChange`, including settles several pages
 *    from the last commit (rapid successive flings).
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { MonthPager, buildWindow, pageIndex } from './MonthPager';

const WIDTH = 320;

// Render centred on Jul 2026, then fire the layout event the jsdom path never
// gets, so the pager measures and mounts the paged FlatList.
function renderMeasured(onMonthChange: (ym: { y: number; m: number }) => void) {
  render(
    <ThemeProvider>
      <MonthPager
        entries={[]}
        y={2026}
        m={6}
        selectedDay={1}
        onSelectDay={() => {}}
        onMonthChange={onMonthChange}
      />
    </ThemeProvider>,
  );
  fireEvent(screen.getByTestId('month-pager'), 'layout', {
    nativeEvent: { layout: { width: WIDTH, height: 300 } },
  });
  return screen.getByTestId('month-pager-list');
}

function settleAt(list: ReturnType<typeof screen.getByTestId>, page: number) {
  fireEvent(list, 'momentumScrollEnd', {
    nativeEvent: {
      contentOffset: { x: page * WIDTH, y: 0 },
      contentSize: { width: 25 * WIDTH, height: 300 },
      layoutMeasurement: { width: WIDTH, height: 300 },
    },
  });
}

describe('MonthPager', () => {
  it('renders the current month as a static 7-column grid before measurement', () => {
    render(
      <ThemeProvider>
        <MonthPager
          entries={[]}
          y={2026}
          m={6}
          selectedDay={1}
          onSelectDay={() => {}}
          onMonthChange={() => {}}
        />
      </ThemeProvider>,
    );
    const rows = screen.getAllByTestId('calendar-week');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(React.Children.count(row.props.children)).toBe(7);
    }
  });

  it('commits the neighbour month when a swipe settles one page over', () => {
    const onMonthChange = jest.fn();
    const list = renderMeasured(onMonthChange);
    // The window is centred on Jul 2026 at index 12; one page right = Aug.
    settleAt(list, 13);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith({ y: 2026, m: 7 });
  });

  it('commits the absolute month after a multi-page settle (rapid flings)', () => {
    const onMonthChange = jest.fn();
    const list = renderMeasured(onMonthChange);
    // Five pages right of Jul 2026 = Dec 2026 — five flings, five months.
    settleAt(list, 17);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange).toHaveBeenCalledWith({ y: 2026, m: 11 });
  });

  it('does not re-commit when the settle lands on the already-shown month', () => {
    const onMonthChange = jest.fn();
    const list = renderMeasured(onMonthChange);
    settleAt(list, 12);
    expect(onMonthChange).not.toHaveBeenCalled();
  });

  it('buildWindow spans the radius each side of the centre, in order', () => {
    const window = buildWindow({ y: 2026, m: 0 }, 2);
    expect(window).toEqual([
      { y: 2025, m: 10 },
      { y: 2025, m: 11 },
      { y: 2026, m: 0 },
      { y: 2026, m: 1 },
      { y: 2026, m: 2 },
    ]);
  });

  it('pageIndex rounds to the nearest page and clamps into the window', () => {
    expect(pageIndex(3 * WIDTH, WIDTH, 25)).toBe(3);
    expect(pageIndex(3 * WIDTH + 2, WIDTH, 25)).toBe(3);
    expect(pageIndex(-40, WIDTH, 25)).toBe(0);
    expect(pageIndex(40 * WIDTH, WIDTH, 25)).toBe(24);
  });
});
