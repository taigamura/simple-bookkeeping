/**
 * MonthPager test (#45). The finger-tracking gesture/animation is verified
 * manually (per the slice), so this covers the non-gesture contract: before the
 * viewport is measured — the jsdom path, where no layout event fires — the pager
 * renders a single static grid for the current month (7-column weeks), so the
 * calendar is fully usable via the ‹ › chevrons with no gesture code exercised.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { MonthPager } from './MonthPager';

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
          onPageChange={() => {}}
        />
      </ThemeProvider>,
    );
    const rows = screen.getAllByTestId('calendar-week');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(React.Children.count(row.props.children)).toBe(7);
    }
  });
});
