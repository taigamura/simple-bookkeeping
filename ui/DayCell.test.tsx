/**
 * DayCell render test (slice #4 acceptance criterion): the cell shows its day
 * number and its activity, hides that activity when the net is zero, and renders
 * as a solid accent cell when selected. Colors are asserted from the flattened
 * Pressable style against the light palette, which is what ThemeProvider
 * resolves to under jest.
 *
 * The cell has two variants. `dots` is the default and is covered by its own
 * block at the bottom; the signed-total assertions here pass `view="numbers"`
 * explicitly, since that variant is now the opt-in one.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { MotionProvider, ThemeProvider, palettes } from '../theme';

const light = palettes.light;
import { DayCell, HEAVY_DAY } from './DayCell';

const renderCell = (props: Partial<React.ComponentProps<typeof DayCell>> = {}) =>
  render(
    <ThemeProvider>
      <DayCell day={5} net={0} selected={false} onPress={() => {}} {...props} />
    </ThemeProvider>,
  );

/** Render in the opt-in signed-total variant. */
const renderNumbers = (props: Partial<React.ComponentProps<typeof DayCell>> = {}) =>
  renderCell({ view: 'numbers', ...props });

const dotStyle = (day: number) => StyleSheet.flatten(screen.getByTestId(`day-dot-${day}`).props.style);

const cellBg = (day: number) => {
  const flat = StyleSheet.flatten(screen.getByLabelText(`Day ${day}`).props.style);
  return flat.backgroundColor;
};

describe('DayCell', () => {
  it('keeps the same native pressable mounted when selection changes with motion enabled', () => {
    const view = render(
      <MotionProvider initialPreference="full">
        <ThemeProvider>
          <DayCell day={5} net={0} selected onPress={() => {}} />
        </ThemeProvider>
      </MotionProvider>,
    );
    const selectedHost = screen.getByLabelText('Day 5');

    view.rerender(
      <MotionProvider initialPreference="full">
        <ThemeProvider>
          <DayCell day={5} net={0} selected={false} onPress={() => {}} />
        </ThemeProvider>
      </MotionProvider>,
    );

    expect(screen.getByLabelText('Day 5')).toBe(selectedHost);
  });

  it('shows the day number', () => {
    renderCell({ day: 12 });
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('shows a positive net with a + prefix and a negative net with unicode minus', () => {
    renderNumbers({ day: 3, net: 1200 });
    expect(screen.getByText('+1,200')).toBeTruthy();
  });

  it('exposes selected state and net value to accessibility', () => {
    renderCell({ day: 3, net: 1200, selected: true });
    const cell = screen.getByLabelText('Day 3');
    expect(cell.props.accessibilityState.selected).toBe(true);
    expect(cell.props.accessibilityValue.text).toBe('Net +1,200');
  });

  it('shows negative nets with the unicode minus', () => {
    renderNumbers({ day: 4, net: -850 });
    expect(screen.getByText('−850')).toBeTruthy();
  });

  it('hides the amount line when the net is zero', () => {
    renderNumbers({ day: 6, net: 0 });
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
    renderNumbers({ day: 10, net: 1200, selected: true });
    const total = StyleSheet.flatten(screen.getByText('+1,200').props.style);
    expect(total.color).toBe(light.onPositive);
    expect(total.opacity).toBe(0.75);
  });

  it('renders an expense total in ink rather than red', () => {
    renderNumbers({ day: 11, net: -850 });
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

describe('DayCell dot variant', () => {
  it('is the default, so an active day shows a dot and no total', () => {
    renderCell({ day: 3, net: -850 });
    expect(dotStyle(3)).toBeTruthy();
    expect(screen.queryByText('−850')).toBeNull();
  });

  it('shows no dot on a day with no activity', () => {
    renderCell({ day: 6, net: 0 });
    expect(screen.queryByTestId('day-dot-6')).toBeNull();
  });

  it('marks income with the accent at full strength', () => {
    renderCell({ day: 4, net: 120000 });
    const dot = dotStyle(4);
    expect(dot.backgroundColor).toBe(light.positive);
    expect(dot.opacity).toBe(1);
  });

  it('holds an ordinary expense back in ink', () => {
    renderCell({ day: 5, net: -(HEAVY_DAY - 1) });
    const dot = dotStyle(5);
    expect(dot.backgroundColor).toBe(light.ink);
    expect(dot.opacity).toBeLessThan(1);
  });

  it('grows the dot once an expense day reaches the heavy threshold', () => {
    renderCell({ day: 7, net: -(HEAVY_DAY - 1) });
    const light_ = dotStyle(7);
    screen.unmount();

    renderCell({ day: 7, net: -HEAVY_DAY });
    const heavy = dotStyle(7);

    expect(heavy.width).toBeGreaterThan(light_.width);
    expect(heavy.opacity).toBeGreaterThan(light_.opacity);
  });

  it('flips to the on-accent color on the selected tile', () => {
    renderCell({ day: 8, net: -850, selected: true });
    expect(dotStyle(8).backgroundColor).toBe(light.onPositive);
  });

  it('still announces the day net, so the variant is purely visual', () => {
    renderCell({ day: 9, net: -850 });
    expect(screen.getByLabelText('Day 9').props.accessibilityValue.text).toBe('Net −850');
  });
});
