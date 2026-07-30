/**
 * SegmentedToggle — a rounded 2+ option switch (Expense/Income in the Entry
 * sheet). Generic over the option value; the active segment fills with
 * `activeColor` (the theme accent by default) and its label flips to
 * `activeTone`.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { strings } from '../i18n';
import { useTheme, metrics, Txt, type Tone } from '../theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Fill color of the active segment. Defaults to the theme accent. */
  activeColor?: string;
  /** Text tone of the active label. Defaults to the on-accent tone. */
  activeTone?: Tone;
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  activeColor,
  activeTone = 'onPositive',
}: SegmentedToggleProps<T>) {
  const { colors } = useTheme();
  const fill = activeColor ?? colors.positive;
  return (
    <View style={[styles.track, { backgroundColor: colors.card2 }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            accessibilityValue={{ text: active ? strings.a11y.selected : strings.a11y.notSelected }}
            style={[styles.item, active && { backgroundColor: fill }]}
          >
            <Txt variant="listItem" tone={active ? activeTone : 'muted'} style={styles.label}>
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: metrics.segRadius,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    height: 40,
    borderRadius: metrics.segItemRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textTransform: 'none' },
});
