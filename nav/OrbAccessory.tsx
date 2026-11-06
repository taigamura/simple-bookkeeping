/**
 * OrbAccessory — the Suito AI orb, docked in the tab bar's accessory slot
 * instead of floating over the Calendar. Tap → Ask (the host scopes it to the
 * visible month on the Calendar), hold → voice entry (`useVoiceEntry`) → the
 * host saves the parse straight away (no Entry sheet) and the strip shows
 * what was added for `SAVED_MS`; a tap in that window edits it instead of
 * asking. A parse the host can't save (no amount) opens the Entry sheet.
 *
 * Placement:
 * - iOS 26 (system `UITabBar`): rendered through `react-native-bottom-tabs`'
 *   `renderBottomAccessoryView`, i.e. UIKit's `tabViewBottomAccessory`: the
 *   glass strip that joins the Liquid Glass bar (Music's mini-player slot).
 *   UIKit draws the glass and sizes the strip; this view only fills it. When
 *   the bar collapses (`placement === 'inline'`) only the first line shows.
 * - Web / Android (custom `TabBar`): the same row in a floating card just above
 *   the bar (`variant="card"`); the host reserves `ACCESSORY_RESERVE` for it.
 *
 * The whole strip is the button. The partial transcript and the short failure
 * messages replace the label line, so nothing grows or moves while you talk.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAi } from '../ai/AiProvider';
import type { Locale, ParseContext, ParsedEntry } from '../ai/contract';
import { yen, type Transaction } from '../domain';
import { useVoiceEntry } from '../ai/useVoiceEntry';
import { strings } from '../i18n';
import { metrics, shadows, useTheme, Txt } from '../theme';
import { AiOrb, LONG_PRESS_MS } from '../ui/AiOrb';

/** Sphere size inside the strip (UIKit's accessory is ~48 pt tall). */
export const ACCESSORY_ORB_SIZE = 34;
/** Height of the web/Android card (the native strip is sized by UIKit). */
export const ACCESSORY_HEIGHT = 52;
/** Gap between the card and the bar below it / the content above it. */
const ACCESSORY_GAP = 8;
/** Bottom band the host reserves for the web/Android card. */
export const ACCESSORY_RESERVE = ACCESSORY_HEIGHT + ACCESSORY_GAP * 2;
/**
 * iOS: the system accessory sits above the bar but `useBottomTabBarHeight`
 * only reports the bar, so tab bodies pad this much more to stay clear of it.
 * Estimated from iOS 26 Music (48 pt strip + 8 pt gap); verify on device.
 */
export const NATIVE_ACCESSORY_CLEARANCE = 56;
/** How long the strip shows a voice-saved entry (and offers "tap to edit"). */
export const SAVED_MS = 5000;

export interface OrbAccessoryProps {
  /** This tab is visible and no sheet is open: holds are allowed and kept. */
  active: boolean;
  locale: Locale;
  parseContext: () => ParseContext;
  onAsk: () => void;
  /** Saves the parse; returns the new entry, or null if the host opened the sheet. */
  onParsed: (entry: ParsedEntry) => Transaction | null;
  /** Opens a just-saved entry for editing. */
  onEdit: (entry: Transaction) => void;
  /** Currency symbol for the "Added" line. */
  symbol: string;
  /** `native`: fills UIKit's glass strip. `card`: draws its own floating card. */
  variant: 'native' | 'card';
  /** UIKit's placement: `inline` = squeezed into the collapsed bar. */
  placement?: 'inline' | 'expanded' | 'none';
  /** `card` only: distance from the container bottom to the bar's top. */
  barInset?: number;
}

export function OrbAccessory({
  active,
  locale,
  parseContext,
  onAsk,
  onParsed,
  onEdit,
  symbol,
  variant,
  placement = 'expanded',
  barInset = 0,
}: OrbAccessoryProps) {
  const { ai } = useAi();
  const { colors } = useTheme();
  const [saved, setSaved] = useState<Transaction | null>(null);
  const voice = useVoiceEntry({
    ai,
    locale,
    parseContext,
    onParsed: (entry) => setSaved(onParsed(entry)),
    active,
  });
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), SAVED_MS);
    return () => clearTimeout(timer);
  }, [saved]);
  // A new hold replaces the "Added" line with the live transcript.
  useEffect(() => {
    if (voice.phase !== 'idle') setSaved(null);
  }, [voice.phase]);

  const status =
    voice.phase === 'listen'
      ? { text: voice.partial || strings.ai.orb.listening, placeholder: !voice.partial }
      : voice.phase === 'think'
        ? { text: voice.partial || strings.ai.orb.reading, placeholder: !voice.partial }
        : voice.message
          ? { text: voice.message, placeholder: false }
          : saved
            ? {
                text: strings.ai.orb.added(yen(saved.amount, symbol), saved.category),
                placeholder: false,
              }
            : null;
  const inline = placement === 'inline';

  const row = (
    <Pressable
      testID="ai-orb"
      onPress={() => {
        if (saved) {
          setSaved(null);
          onEdit(saved);
        } else onAsk();
      }}
      onLongPress={voice.start}
      onPressOut={voice.release}
      delayLongPress={LONG_PRESS_MS}
      accessibilityRole="button"
      accessibilityLabel={strings.ai.orb.label}
      accessibilityHint={saved ? strings.ai.orb.tapToEdit : strings.ai.orb.hint}
      accessibilityState={{ busy: voice.phase === 'think' }}
      accessibilityValue={{ text: voice.phase }}
      // react-native-web drops `accessibilityValue`; this reaches the DOM as aria-valuetext.
      aria-valuetext={voice.phase}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {/* Drawing only: the strip is the button, so the sphere takes no touches
          and isn't a second accessibility element. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <AiOrb
          testID="ai-orb-sphere"
          decorative
          size={inline ? ACCESSORY_ORB_SIZE - 8 : ACCESSORY_ORB_SIZE}
          state={voice.phase}
          level={voice.level}
        />
      </View>
      <View style={styles.text}>
        {status ? (
          <>
            <Txt
              testID="ai-orb-bubble"
              accessibilityLiveRegion="polite"
              variant="optionLabel"
              tone={status.placeholder ? 'dim' : 'ink'}
              numberOfLines={inline || saved ? 1 : 2}
            >
              {status.text}
            </Txt>
            {saved && !inline && (
              <Txt variant="secondary" tone="positive" numberOfLines={1}>
                {strings.ai.orb.tapToEdit}
              </Txt>
            )}
          </>
        ) : (
          <>
            <Txt variant="optionLabel" tone="ink" numberOfLines={1}>
              {strings.ai.orb.label}
            </Txt>
            {!inline && (
              <Txt variant="secondary" tone="dim" numberOfLines={1}>
                {strings.ai.orb.accessoryHint}
              </Txt>
            )}
          </>
        )}
      </View>
    </Pressable>
  );

  if (variant === 'native') return <View style={styles.fill}>{row}</View>;

  return (
    <View
      testID="ai-orb-dock"
      pointerEvents="box-none"
      style={[styles.dock, { bottom: barInset + ACCESSORY_GAP }]}
    >
      <View
        style={[
          styles.card,
          shadows.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {row}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: '100%',
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, justifyContent: 'center' },
  dock: {
    position: 'absolute',
    left: metrics.tabBarFloatMargin + 10,
    right: metrics.tabBarFloatMargin + 10,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    height: ACCESSORY_HEIGHT,
    borderRadius: ACCESSORY_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
