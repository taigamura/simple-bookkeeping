/**
 * AdCard — the static house-ad placeholder (decision 7: no real ad network).
 * Two variants: `banner` (Calendar & Summary, above the tab bar) and `slim`
 * (Entry sheet, above the keypad). Always the same house creative ("Kaji
 * Cash-back Card · Sponsored"); the parent decides whether to render it based
 * on the `premium` flag.
 */
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, metrics, Txt } from '../theme';

interface AdCardProps {
  variant?: 'banner' | 'slim';
}

export function AdCard({ variant = 'banner' }: AdCardProps) {
  const { colors } = useTheme();
  const slim = variant === 'slim';
  return (
    <View
      accessibilityLabel="Sponsored ad"
      style={[
        styles.card,
        {
          backgroundColor: colors.card2,
          borderColor: colors.border,
          height: slim ? 48 : metrics.adReserve,
        },
      ]}
    >
      <View style={[styles.tile, { backgroundColor: colors.card3 }]}>
        <Feather name="credit-card" size={slim ? 15 : 18} color={colors.muted} />
      </View>
      <View style={styles.copy}>
        <Txt variant="listItem" tone="ink" numberOfLines={1}>
          Kaji Cash-back Card
        </Txt>
        {!slim && (
          <Txt variant="secondary" tone="dim" numberOfLines={1}>
            Earn 2% back on everything you track.
          </Txt>
        )}
      </View>
      <Txt variant="microLabel" tone="dim">
        Sponsored
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: metrics.cardRadius,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  tile: {
    width: 34,
    height: 34,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
});
