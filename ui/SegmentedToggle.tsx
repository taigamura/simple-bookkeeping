/**
 * SegmentedToggle — a pill-shaped 2+ option switch (Expense/Income in the Entry
 * sheet, Dark/Light in Settings). Generic over the option value; the active
 * segment fills with `activeColor` (green by default) and its label flips to
 * `activeTone`.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme, metrics, accents, Txt, type Tone } from '../theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Fill color of the active segment. Defaults to the positive green. */
  activeColor?: string;
  /** Text tone of the active label. Defaults to near-black on-green. */
  activeTone?: Tone;
}

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  activeColor = accents.positive,
  activeTone = 'onPositive',
}: SegmentedToggleProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.card2 }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[styles.item, active && { backgroundColor: activeColor }]}
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
    borderRadius: metrics.pill,
    padding: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    height: 40,
    borderRadius: metrics.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textTransform: 'none' },
});
