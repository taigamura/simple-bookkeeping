/**
 * TabBar render test (design fidelity §12): the active tab (icon color) is green
 * rather than ink, the inactive tab is dim, and the center ＋ FAB carries the
 * green glow shadow. Colors/shadow are asserted from the flattened styles.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, palettes, metrics } from '../theme';

const light = palettes.light;
import { TabBar } from './TabBar';

// A device with a home-indicator bottom inset, so the bottom-edge anchoring
// (#41) is exercised deterministically.
const BOTTOM_INSET = 34;
const initialMetrics = {
  frame: { x: 0, y: 0, width: 402, height: 800 },
  insets: { top: 52, left: 0, right: 0, bottom: BOTTOM_INSET },
};

const renderBar = (props: Partial<React.ComponentProps<typeof TabBar>> = {}) =>
  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider>
        <TabBar tab="calendar" onSelect={() => {}} onAdd={() => {}} {...props} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

describe('TabBar', () => {
  it('renders both tab labels and the add button', () => {
    renderBar();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByLabelText('Add entry')).toBeTruthy();
  });

  it('tints the active tab label with the accent (design §12)', () => {
    renderBar({ tab: 'calendar' });
    const active = StyleSheet.flatten(screen.getByText('Calendar').props.style);
    expect(active.color).toBe(light.positive);
  });

  it('leaves the inactive tab label dim, not accented', () => {
    renderBar({ tab: 'calendar' });
    const inactive = StyleSheet.flatten(screen.getByText('Summary').props.style);
    expect(inactive.color).not.toBe(light.positive);
  });

  it('gives the ＋ FAB an accent glow (design §12)', () => {
    renderBar();
    const fab = StyleSheet.flatten(screen.getByLabelText('Add entry').props.style);
    expect(fab.shadowColor).toBe(light.positive);
    expect(fab.shadowOpacity).toBe(0.3);
  });

  it('fires onAdd when the FAB is pressed', () => {
    const onAdd = jest.fn();
    renderBar({ onAdd });
    fireEvent.press(screen.getByLabelText('Add entry'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('reports the selected tab', () => {
    const onSelect = jest.fn();
    renderBar({ onSelect });
    fireEvent.press(screen.getByLabelText('Summary'));
    expect(onSelect).toHaveBeenCalledWith('summary');
  });

  it('floats above the bottom edge: offset by the safe-area inset plus the float margin (#41)', () => {
    renderBar();
    // Climb from the FAB to the floating wrapper — the first absolutely
    // positioned ancestor (the glass fill/blur layers are siblings, not
    // ancestors, so they are not reached on the way up).
    let node: ReturnType<typeof screen.getByLabelText> | null =
      screen.getByLabelText('Add entry');
    while (node && StyleSheet.flatten(node.props.style)?.position !== 'absolute') {
      node = node.parent;
    }
    const wrapper = StyleSheet.flatten(node?.props.style);
    expect(wrapper.position).toBe('absolute');
    expect(wrapper.bottom).toBe(BOTTOM_INSET + metrics.tabBarFloatMargin);
  });
});
