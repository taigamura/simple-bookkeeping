/**
 * TabBar — the custom bottom bar (decision 3). Two tabs (Calendar · Summary)
 * flanking a raised center accent ＋ FAB that opens the Entry sheet. No
 * react-navigation: it just reflects/sets the root's `tab` and fires `onAdd`.
 * Tabs use Feather calendar + bar-chart; the FAB uses plus (decision 6).
 *
 * The FAB is a `PressScale` (`control` — a 54px target needs the bigger
 * factor to read at all) on top of its existing opacity dip and glow, same
 * reasoning as every other small square control in the shell.
 *
 * `TabButton`'s active state used to just snap `color` between `dim` and
 * `positive` on the icon and label. That is fine for the label — flipping
 * two words of text mid-fade looks like a rendering glitch, not motion, so it
 * stays instant — but the icon is a single glyph that switching tabs puts
 * front and center, and a snap there reads as the app skipping a frame. Two
 * things fix that without touching `interpolateColor` (stubbed to `undefined`
 * under the jest mock, see `theme/motion.ts`): the icon is drawn twice, once
 * in each tone, stacked and cross-faded by animating plain `opacity` on each
 * layer; and the *becoming*-active icon gets a one-shot scale bump (1 → 1.15 →
 * 1) so arriving at a tab feels like it landed, not like it was just
 * recolored. The bump is modeled as an additive delta that rests at 0 rather
 * than an absolute scale that rests at 1, because `withSequence` resolves to
 * `0` under the jest mock — with an additive delta that resting value is
 * exactly the correct "no bump" state, so the mock never puts the icon at a
 * broken scale.
 */
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { strings } from '../i18n';
import {
  useTheme,
  useMotion,
  metrics,
  springs,
  glowFor,
  withAppSequence,
  withAppSpring,
  Txt,
} from '../theme';
import { PressScale } from '../ui';
import type { Tab } from './types';

interface TabBarProps {
  tab: Tab;
  onSelect: (tab: Tab) => void;
  onAdd: () => void;
}

interface TabDef {
  key: Tab;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}

const TABS: TabDef[] = [
  { key: 'calendar', label: strings.nav.calendar, icon: 'calendar' },
  { key: 'summary', label: strings.nav.summary, icon: 'bar-chart-2' },
];

export function TabBar({ tab, onSelect, onAdd }: TabBarProps) {
  const { colors } = useTheme();
  // Extend the bar's card flush to the physical bottom edge (#41): grow the
  // height by the safe-area bottom inset and pad by the same, so the icons/labels
  // clear the home indicator while the background reaches the device edge.
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: metrics.tabBarHeight + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <TabButton def={TABS[0]} active={tab === 'calendar'} onPress={onSelect} />

      <PressScale
        scale="control"
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={strings.nav.addEntry}
        style={({ pressed }) => [
          styles.fab,
          glowFor(colors.positive),
          { backgroundColor: colors.positive, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="plus" size={26} color={colors.onPositive} />
      </PressScale>

      <TabButton def={TABS[1]} active={tab === 'summary'} onPress={onSelect} />
    </View>
  );
}

function TabButton({
  def,
  active,
  onPress,
}: {
  def: TabDef;
  active: boolean;
  onPress: (tab: Tab) => void;
}) {
  const { colors } = useTheme();
  const { enabled } = useMotion();

  // Starts already resolved to the initial `active` prop rather than always
  // at 0, so a bar that mounts with a tab already selected (every mount, in
  // practice — there is no "no tab selected" state) never shows a spurious
  // fade-in on first paint.
  const colorProgress = useSharedValue(active ? 1 : 0);
  const bump = useSharedValue(0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (!enabled) {
      // Reduced motion: jump straight to the end state, no cross-fade and no
      // landing bump — see theme/MotionProvider's header for why a zeroed
      // animation is not an acceptable substitute for skipping it outright.
      colorProgress.value = active ? 1 : 0;
      wasActive.current = active;
      return;
    }
    colorProgress.value = withAppSpring(active ? 1 : 0, springs.snap);
    // Only the tab that just *became* active gets the landing bump — the one
    // that just lost focus should fade quietly, not also hop.
    if (active && !wasActive.current) {
      bump.value = withAppSequence(
        withAppSpring(0.15, springs.pop),
        withAppSpring(0, springs.press),
      );
    }
    wasActive.current = active;
  }, [active, enabled, colorProgress, bump]);

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: colorProgress.value,
    transform: [{ scale: 1 + bump.value }],
  }));
  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - colorProgress.value,
  }));

  return (
    <Pressable
      onPress={() => onPress(def.key)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={def.label}
      style={styles.tab}
    >
      <View style={styles.iconStack}>
        <Animated.View style={inactiveIconStyle}>
          <Feather name={def.icon} size={20} color={colors.dim} />
        </Animated.View>
        <Animated.View style={[styles.iconStackLayer, activeIconStyle]}>
          <Feather name={def.icon} size={20} color={colors.positive} />
        </Animated.View>
      </View>
      <Txt variant="microLabel" tone={active ? 'positive' : 'dim'} style={styles.tabLabel}>
        {def.label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: metrics.tabBarHeight,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  tabLabel: { marginTop: 1 },
  // The two icon layers stack exactly on top of each other so the cross-fade
  // reads as one glyph recoloring, not two glyphs swapping.
  iconStack: { width: 20, height: 20 },
  iconStackLayer: { position: 'absolute', top: 0, left: 0 },
  fab: {
    width: metrics.fabSize,
    height: metrics.fabSize,
    borderRadius: metrics.fabRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    marginHorizontal: 8,
  },
});
