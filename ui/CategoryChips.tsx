/**
 * CategoryChips — the horizontally-scrolling chip row in the Entry sheet. The
 * selected chip fills with the accent; the rest are soft card2 fills with muted
 * labels. Presentational: parent owns the selection.
 *
 * Picking a category used to snap the chip's background straight from card2
 * to the accent, which — in a row that can hold a dozen chips and gets
 * re-tapped while someone is still deciding — reads as flicker more than as
 * selection. The accent is now a separate absolutely-positioned fill layer
 * under the label, permanently mounted at every chip and springing its
 * `opacity` between 0 and 1 (`springs.snap`, the same spring the day-cell and
 * segmented-toggle selections use, so "this got selected" feels consistent
 * across the app). The base chip keeps its card2 background underneath, so a
 * chip mid-fade-out shows the accent bleeding away rather than an abrupt hole.
 * The label's tone still flips instantly rather than fading — a label
 * crossfading through a low-contrast mid-tone is harder to read than one that
 * changes on the beat, and unlike the fill it's read as text, not as a shape.
 * `PressScale` (`surface` — a chip is a wide-ish tappable pill, not a small
 * square control) layers the usual press feedback on top of both.
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { strings } from '../i18n';
import { useTheme, useMotion, metrics, springs, withAppSpring, Txt } from '../theme';
import { PressScale } from './PressScale';

interface CategoryChipsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function CategoryChips({ categories, selected, onSelect }: CategoryChipsProps) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {categories.map((cat) => {
        const active = cat === selected;
        return (
          <Chip key={cat} label={cat} active={active} onSelect={() => onSelect(cat)} />
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { colors } = useTheme();
  const { enabled } = useMotion();
  // Resolved to the initial `active` value up front so a chip that mounts
  // already selected (editing an existing entry) doesn't fade in from empty.
  const fillProgress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    fillProgress.value = enabled ? withAppSpring(active ? 1 : 0, springs.snap) : active ? 1 : 0;
  }, [active, enabled, fillProgress]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fillProgress.value }));

  return (
    <PressScale
      scale="surface"
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityValue={{ text: active ? strings.a11y.selected : strings.a11y.notSelected }}
      style={[styles.chip, { backgroundColor: colors.card2 }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: colors.positive }, fillStyle]}
      />
      <Txt variant="listItem" tone={active ? 'onPositive' : 'muted'}>
        {label}
      </Txt>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: metrics.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
    // The accent fill is an absolutely-positioned sibling of the label, so it
    // needs the chip to clip it to the same rounded corners.
    overflow: 'hidden',
  },
  fill: { borderRadius: metrics.chipRadius },
});
