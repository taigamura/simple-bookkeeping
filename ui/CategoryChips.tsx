/**
 * CategoryChips — the horizontally-scrolling pill row in the Entry sheet. The
 * selected chip fills green with near-black text (the shared selection accent);
 * the rest are muted pills. Presentational: parent owns the selection.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { useTheme, metrics, accents, Txt } from '../theme';

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
          <Pressable
            key={cat}
            onPress={() => onSelect(cat)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              { backgroundColor: active ? accents.positive : colors.card2 },
            ]}
          >
            <Txt variant="listItem" tone={active ? 'onPositive' : 'muted'}>
              {cat}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: metrics.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
