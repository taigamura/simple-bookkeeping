/**
 * Suito AI surfaces on Summary (ADR-0006): the 「聞く」 pill on the hero, the
 * monthly letter card, its reopen row, and the one-line nudge.
 *
 * Kippu tokens only (ADR-0002): the letter and the nudge are plain `card`
 * surfaces with ink/positive text, the pill is an outline on the `deep` hero
 * that reuses the hero's own translucent white. No new colours.
 *
 * Motion (ADR-0003): the letter and nudge fade in once when they first appear
 * (they confirm that something arrived). Nothing loops, and with motion off
 * they simply appear.
 *
 * Numbers never come from model text: each paragraph is rendered through
 * `renderCited` with the displays frozen when the letter was written, and a
 * paragraph that fails to render is dropped rather than shown raw.
 */
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { renderCited } from '../ai';
import { strings } from '../i18n';
import { ReduceMotion, durations, metrics, useMotion, useTheme, Txt } from '../theme';
import { PressScale } from './PressScale';

/** Hero-safe outline (same translucent white the hero's legend uses). */
const ON_DEEP_OUTLINE = 'rgba(255,255,255,.42)';

export function AskPill({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressScale
      scale="control"
      onPress={onPress}
      testID="ask-pill"
      accessibilityRole="button"
      accessibilityLabel={strings.ai.askA11y}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        { borderColor: ON_DEEP_OUTLINE, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Feather name="message-circle" size={13} color={colors.onDeep} />
      <Txt variant="secondary" tone="onDeep">
        {strings.ai.ask}
      </Txt>
    </PressScale>
  );
}

function useFadeIn() {
  const { enabled } = useMotion();
  return enabled ? FadeIn.duration(durations.base).reduceMotion(ReduceMotion.Never) : undefined;
}

function CloseButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressScale
      scale="control"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.close,
        { backgroundColor: colors.card2, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Feather name="x" size={14} color={colors.muted} />
    </PressScale>
  );
}

export function LetterCard({
  m,
  paragraphs,
  facts,
  onDismiss,
}: {
  /** 0-based month the letter is about. */
  m: number;
  paragraphs: string[];
  facts: Record<string, string>;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const entering = useFadeIn();
  const rendered = paragraphs
    .map((p) => renderCited(p, facts))
    .filter((p): p is string => p !== null && p.trim() !== '');
  if (rendered.length === 0) return null;
  const title = strings.ai.letterTitle(m);
  return (
    <Animated.View
      entering={entering}
      testID="ai-letter"
      accessible
      accessibilityLabel={`${title}. ${rendered.join(' ')}`}
      style={[styles.card, { backgroundColor: colors.card }]}
    >
      <View style={styles.cardHeader}>
        <Txt variant="microLabel" tone="positive" style={styles.flex}>
          {title}
        </Txt>
        <CloseButton label={strings.ai.letterDismiss} onPress={onDismiss} />
      </View>
      {rendered.map((p, i) => (
        <Txt key={i} variant="optionLabel" tone="ink" style={styles.paragraph}>
          {p}
        </Txt>
      ))}
    </Animated.View>
  );
}

export function LetterReopenRow({ m, onPress }: { m: number; onPress: () => void }) {
  const { colors } = useTheme();
  const label = strings.ai.letterReopen(m);
  return (
    <Pressable
      onPress={onPress}
      testID="ai-letter-reopen"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.card3 : colors.card },
      ]}
    >
      <Feather name="book-open" size={15} color={colors.positive} />
      <Txt variant="optionLabel" tone="positive" style={styles.flex}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function NudgeRow({
  text,
  facts,
  onDismiss,
}: {
  text: string;
  facts: Record<string, string>;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const entering = useFadeIn();
  const rendered = renderCited(text, facts);
  if (rendered === null || rendered.trim() === '') return null;
  return (
    <Animated.View
      entering={entering}
      testID="ai-nudge"
      style={[styles.row, { backgroundColor: colors.card }]}
    >
      <Feather name="sun" size={15} color={colors.positive} />
      <Txt
        variant="optionLabel"
        tone="ink"
        numberOfLines={2}
        style={styles.flex}
        accessibilityLabel={`${strings.ai.nudgeLabel}: ${rendered}`}
      >
        {rendered}
      </Txt>
      <CloseButton label={strings.ai.nudgeDismiss} onPress={onDismiss} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: metrics.pill,
    borderWidth: 1,
  },
  close: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: metrics.cardRadius,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paragraph: { lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: metrics.iconTileRadius + 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
});
