/**
 * NativeTabHost — on iOS the tab bar is the OS's own UITabBar (through
 * `react-native-bottom-tabs`), not a React Native view. On iOS 26 that is
 * Apple's genuine Liquid Glass bar: the floating glass capsule, the morphing
 * selection lens and its refraction are drawn by UIKit exactly as in Apple's
 * own apps. Nothing here paints glass; hand-built replicas never read as
 * native (see the history in `TabBar.tsx`). Below iOS 26 the same code yields
 * the standard UITabBar.
 *
 * The ＋ can't sit between two system tab items, so it takes Apple's iOS 26
 * slot for a primary action: a `search`-role item, which UIKit renders as a
 * separate glass circle beside the bar (the Music / Photos layout). It is
 * `preventsDefault`, so tapping it fires `onIndexChange` without switching
 * tabs, and we open the entry sheet instead.
 *
 * Web and Android keep the custom `TabBar` (Root picks via `NATIVE_TABS`).
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import TabView, { useBottomTabBarHeight } from 'react-native-bottom-tabs';

import { strings } from '../i18n';
import { useTheme } from '../theme';
import type { Tab } from './types';

type RouteKey = Tab | 'add';

interface NativeTabHostProps {
  tab: Tab;
  onSelect: (tab: Tab) => void;
  onAdd: () => void;
  /** One tab's body (Root's `renderTab`). */
  render: (tab: Tab) => React.ReactNode;
}

const ROUTES = [
  {
    key: 'calendar' as RouteKey,
    title: strings.nav.calendar,
    focusedIcon: { sfSymbol: 'calendar' as const },
  },
  {
    key: 'summary' as RouteKey,
    title: strings.nav.summary,
    focusedIcon: { sfSymbol: 'chart.bar.fill' as const },
  },
  {
    key: 'add' as RouteKey,
    title: strings.nav.addEntry,
    focusedIcon: { sfSymbol: 'plus' as const },
    role: 'search' as const,
    preventsDefault: true,
  },
];

export function NativeTabHost({ tab, onSelect, onAdd, render }: NativeTabHostProps) {
  const { colors } = useTheme();
  const navigationState = useMemo(
    () => ({ index: tab === 'summary' ? 1 : 0, routes: ROUTES }),
    [tab],
  );

  return (
    <TabView
      navigationState={navigationState}
      onIndexChange={(index) => {
        const key = ROUTES[index]?.key;
        if (key === 'add') onAdd();
        else if (key) onSelect(key);
      }}
      renderScene={({ route }) =>
        route.key === 'add' ? null : <Scene>{render(route.key as Tab)}</Scene>
      }
      tabBarActiveTintColor={colors.positive}
      hapticFeedbackEnabled
    />
  );
}

/** A tab body, kept clear of the bar so no content hides behind it. */
function Scene({ children }: { children: React.ReactNode }) {
  const barHeight = useBottomTabBarHeight();
  return <View style={[styles.scene, { paddingBottom: barHeight }]}>{children}</View>;
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
});
