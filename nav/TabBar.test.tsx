/**
 * TabBar render test (design fidelity §12): the active tab (icon color) is green
 * rather than ink, the inactive tab is dim, and the center ＋ FAB carries the
 * green glow shadow. Colors/shadow are asserted from the flattened styles.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, accents, metrics } from '../theme';
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

  it('tints the active tab label green (design §12)', () => {
    renderBar({ tab: 'calendar' });
    const active = StyleSheet.flatten(screen.getByText('Calendar').props.style);
    expect(active.color).toBe(accents.positive);
  });

  it('leaves the inactive tab label dim, not green', () => {
    renderBar({ tab: 'calendar' });
    const inactive = StyleSheet.flatten(screen.getByText('Summary').props.style);
    expect(inactive.color).not.toBe(accents.positive);
  });

  it('gives the ＋ FAB a green glow (design §12)', () => {
    renderBar();
    const fab = StyleSheet.flatten(screen.getByLabelText('Add entry').props.style);
    expect(fab.shadowColor).toBe(accents.positive);
    expect(fab.shadowOpacity).toBe(0.32);
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

  it('anchors to the bottom edge: pads by and grows into the safe-area inset (#41)', () => {
    renderBar();
    // Climb from the FAB to the bar view — the one carrying the inset padding.
    let node: ReturnType<typeof screen.getByLabelText> | null =
      screen.getByLabelText('Add entry');
    while (node && StyleSheet.flatten(node.props.style)?.paddingBottom === undefined) {
      node = node.parent;
    }
    const bar = StyleSheet.flatten(node?.props.style);
    expect(bar.paddingBottom).toBe(BOTTOM_INSET);
    expect(bar.height).toBe(metrics.tabBarHeight + BOTTOM_INSET);
  });
});
