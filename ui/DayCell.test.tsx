/**
 * DayCell render test (slice #4 acceptance criterion): the cell shows its day
 * number and signed net, hides the amount when the net is zero, and renders as a
 * solid accent cell when selected. Colors are asserted from the flattened
 * Pressable style against the light palette, which is what ThemeProvider
 * resolves to under jest.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThemeProvider, palettes } from '../theme';

const light = palettes.light;
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

  it('renders a solid accent cell when selected', () => {
    renderCell({ day: 7, selected: true });
    expect(cellBg(7)).toBe(light.positive);
  });

  it('sits on the card fill when unselected', () => {
    renderCell({ day: 8, selected: false });
    expect(cellBg(8)).toBe(light.card);
  });

  it('keeps today visible with an accent outline when another day is selected', () => {
    renderCell({ day: 8, selected: false, today: true });
    const flat = StyleSheet.flatten(screen.getByLabelText('Day 8').props.style);
    expect(flat.borderColor).toBe(light.positive);
    expect(flat.borderWidth).toBeGreaterThan(0);
    expect(flat.backgroundColor).toBe(light.card);
  });

  it('drops the outline once today is itself the selected day', () => {
    renderCell({ day: 9, selected: true, today: true });
    const flat = StyleSheet.flatten(screen.getByLabelText('Day 9').props.style);
    expect(flat.backgroundColor).toBe(light.positive);
    expect(flat.borderWidth).toBeUndefined();
  });

  it('renders the selected-day total in the recessive on-accent tone', () => {
    renderCell({ day: 10, net: 1200, selected: true });
    const total = StyleSheet.flatten(screen.getByText('+1,200').props.style);
    expect(total.color).toBe(light.onPositive);
    expect(total.opacity).toBe(0.75);
  });

  it('renders an expense total in ink rather than red', () => {
    renderCell({ day: 11, net: -850 });
    const total = StyleSheet.flatten(screen.getByText('−850').props.style);
    expect(total.color).toBe(light.ink);
    expect(total.color).not.toBe(light.negative);
  });

  it('reports the tapped day', () => {
    const onPress = jest.fn();
    renderCell({ day: 9, onPress });
    fireEvent.press(screen.getByLabelText('Day 9'));
    expect(onPress).toHaveBeenCalledWith(9);
  });
});
