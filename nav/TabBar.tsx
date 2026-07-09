/**
 * TabBar — the custom bottom bar (decision 3). Two tabs (Calendar · Summary)
 * flanking a raised center green ＋ FAB that opens the Entry sheet. No
 * react-navigation: it just reflects/sets the root's `tab` and fires `onAdd`.
 * Tabs use Feather calendar + bar-chart; the FAB uses plus (decision 6).
 */
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '../i18n';
import { useTheme, metrics, accents, shadows, Txt } from '../theme';
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

      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={strings.nav.addEntry}
        style={({ pressed }) => [
          styles.fab,
          shadows.fabGlow,
          { backgroundColor: accents.positive, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Feather name="plus" size={26} color={accents.onPositive} />
      </Pressable>

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
  const color = active ? colors.positive : colors.dim;
  return (
    <Pressable
      onPress={() => onPress(def.key)}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={def.label}
      style={styles.tab}
    >
      <Feather name={def.icon} size={20} color={color} />
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
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    marginHorizontal: 8,
  },
});
