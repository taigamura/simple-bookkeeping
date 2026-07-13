/**
 * DayCell render test (slice #4 acceptance criterion): the cell shows its day
 * number and signed net, hides the amount when the net is zero, and renders as a
 * solid green cell when selected. Selection color is asserted from the flattened
 * Pressable style.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { accents } from '../theme';
import { ThemeProvider } from '../theme';
import { DayCell } from './DayCell';

const renderCell = (props: Partial<React.ComponentProps<typeof DayCell>> = {}) =>
  render(
    <ThemeProvider>
      <DayCell day={5} net={0} selected={false} onPress={() => {}} {...props} />
    </ThemeProvider>,
  );

const cellBg = (day: number) => {
  const flat = StyleSheet.flatten(screen.getByLabelText(`Day ${day}`).props.style);
  return flat.backgroundColor;
};

describe('DayCell', () => {
  it('shows the day number', () => {
    renderCell({ day: 12 });
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('shows a positive net with a + prefix and a negative net with unicode minus', () => {
    renderCell({ day: 3, net: 1200 });
    expect(screen.getByText('+1,200')).toBeTruthy();
  });

  it('exposes selected state and net value to accessibility', () => {
    renderCell({ day: 3, net: 1200, selected: true });
    const cell = screen.getByLabelText('Day 3');
    expect(cell.props.accessibilityState.selected).toBe(true);
    expect(cell.props.accessibilityValue.text).toBe('Net +1,200');
  });

  it('shows negative nets with the unicode minus', () => {
    renderCell({ day: 4, net: -850 });
    expect(screen.getByText('−850')).toBeTruthy();
  });

  it('hides the amount line when the net is zero', () => {
    renderCell({ day: 6, net: 0 });
    expect(screen.queryByText('+0')).toBeNull();
    expect(screen.queryByText('0')).toBeNull(); // only the day number "6" shows
  });

  it('renders a solid green cell when selected', () => {
    renderCell({ day: 7, selected: true });
    expect(cellBg(7)).toBe(accents.positive);
  });

  it('is transparent when unselected (design §1)', () => {
    renderCell({ day: 8, selected: false });
    expect(cellBg(8)).toBe('transparent');
  });

  it('renders the selected-day total in translucent near-black (design §1)', () => {
    renderCell({ day: 10, net: 1200, selected: true });
    const total = StyleSheet.flatten(screen.getByText('+1,200').props.style);
    expect(total.color).toBe('rgba(11,14,18,.7)');
  });

  it('reports the tapped day', () => {
    const onPress = jest.fn();
    renderCell({ day: 9, onPress });
    fireEvent.press(screen.getByLabelText('Day 9'));
    expect(onPress).toHaveBeenCalledWith(9);
  });
});
