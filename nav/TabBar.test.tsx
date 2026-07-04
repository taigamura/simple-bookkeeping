/**
 * TabBar render test (design fidelity §12): the active tab (icon color) is green
 * rather than ink, the inactive tab is dim, and the center ＋ FAB carries the
 * green glow shadow. Colors/shadow are asserted from the flattened styles.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThemeProvider, accents } from '../theme';
import { TabBar } from './TabBar';

const renderBar = (props: Partial<React.ComponentProps<typeof TabBar>> = {}) =>
  render(
    <ThemeProvider>
      <TabBar tab="calendar" onSelect={() => {}} onAdd={() => {}} {...props} />
    </ThemeProvider>,
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
});
