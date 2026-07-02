/**
 * ThemePreview — a temporary Stage-2 harness to eyeball the design system on
 * web: every type variant, the palette surfaces, accents, and the manual
 * dark/light toggle (decision 9). Removed once real screens land in Stage 5.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './ThemeProvider';
import { Txt } from './Txt';
import { accents, metrics, type TypeVariant } from './tokens';

const VARIANTS: TypeVariant[] = [
  'heroAmount',
  'summaryNet',
  'screenTitle',
  'listItem',
  'secondary',
  'microLabel',
  'inlineAmount',
  'calendarDay',
  'calendarDayTotal',
];

function Body() {
  const { mode, colors, toggle } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Txt variant="screenTitle">Kaji · Design System</Txt>
          <Pressable
            onPress={toggle}
            style={[styles.toggle, { backgroundColor: colors.card3 }]}
          >
            <Txt variant="microLabel" tone="muted">
              {mode}
            </Txt>
          </Pressable>
        </View>

        <Txt variant="microLabel" tone="dim">
          Type scale
        </Txt>
        {VARIANTS.map((v) => (
          <View
            key={v}
            style={[styles.row, { borderBottomColor: colors.hair }]}
          >
            <Txt variant="secondary" tone="dim">
              {v}
            </Txt>
            <Txt variant={v}>1,234</Txt>
          </View>
        ))}

        <Txt variant="microLabel" tone="dim" style={styles.gap}>
          Accents
        </Txt>
        <View style={styles.accentRow}>
          <Txt variant="inlineAmount" tone="positive">
            +1,200 income
          </Txt>
          <Txt variant="inlineAmount" tone="negative">
            −850 expense
          </Txt>
        </View>
        <View
          style={[styles.cta, { backgroundColor: accents.positive }]}
        >
          <Txt variant="listItem" tone="onPositive">
            Primary CTA (on-green = near-black)
          </Txt>
        </View>

        <Txt variant="microLabel" tone="dim" style={styles.gap}>
          Surfaces
        </Txt>
        {(['card', 'card2', 'card3'] as const).map((s) => (
          <View
            key={s}
            style={[
              styles.surface,
              { backgroundColor: colors[s], borderColor: colors.border },
            ]}
          >
            <Txt variant="secondary" tone="muted">
              {s}
            </Txt>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ThemePreview() {
  return (
    <SafeAreaProvider>
      <Body />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: metrics.screenPadX, gap: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: metrics.pill,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accentRow: { flexDirection: 'row', gap: 20 },
  gap: { marginTop: 20 },
  cta: {
    height: metrics.ctaHeight,
    borderRadius: metrics.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  surface: {
    borderRadius: metrics.cardRadius,
    borderWidth: 1,
    padding: 16,
  },
});
