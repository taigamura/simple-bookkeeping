/**
 * NativeTabHost — the iOS host that hands the tab bar to the OS (UITabBar via
 * react-native-bottom-tabs), so iOS 26 draws its genuine Liquid Glass bar.
 *
 * The native view can't run under jest, so `react-native-bottom-tabs` is
 * replaced by a tiny JS stand-in that honours the library's contract: it shows
 * the focused route's scene, exposes one pressable per route labelled by its
 * title, and reports a press as `onIndexChange(index)` — including for a
 * `preventsDefault` route, which natively fires the event without switching.
 * These tests pin what Root relies on: which scene shows, tab presses select,
 * and the ＋ opens the entry sheet instead of becoming a tab.
 */
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { NativeTabHost } from './NativeTabHost';
import type { Tab } from './types';

jest.mock('react-native-bottom-tabs', () => {
  const R = require('react');
  const { Pressable, Text: T, View } = require('react-native');
  function TabView({ navigationState, renderScene, onIndexChange }: any) {
    const route = navigationState.routes[navigationState.index];
    return R.createElement(
      View,
      null,
      R.createElement(View, null, renderScene({ route, jumpTo: () => {} })),
      navigationState.routes.map((r: any, i: number) =>
        R.createElement(
          Pressable,
          {
            key: r.key,
            accessibilityLabel: r.title,
            accessibilityRole: r.role === 'search' ? 'button' : 'tab',
            onPress: () => onIndexChange(i),
          },
          R.createElement(T, null, r.title),
        ),
      ),
    );
  }
  return { __esModule: true, default: TabView, useBottomTabBarHeight: () => 0 };
});

function renderHost(tab: Tab, overrides: Partial<React.ComponentProps<typeof NativeTabHost>> = {}) {
  const props = {
    tab,
    onSelect: jest.fn(),
    onAdd: jest.fn(),
    render: (which: Tab) => <Text>{`${which} body`}</Text>,
    ...overrides,
  };
  render(
    <ThemeProvider>
      <NativeTabHost {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('NativeTabHost', () => {
  it('shows the body of the active tab', () => {
    renderHost('summary');
    expect(screen.getByText('summary body')).toBeTruthy();
    expect(screen.queryByText('calendar body')).toBeNull();
  });

  it('selects a tab when its native tab item is pressed', () => {
    const props = renderHost('calendar');
    fireEvent.press(screen.getByLabelText('Summary'));
    expect(props.onSelect).toHaveBeenCalledWith('summary');
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('opens the entry sheet from the ＋ without switching tabs', () => {
    const props = renderHost('calendar');
    fireEvent.press(screen.getByLabelText('Add entry'));
    expect(props.onAdd).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
