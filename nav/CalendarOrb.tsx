/**
 * CalendarOrb — places the Suito AI orb on the Calendar tab and wires it:
 * tap → Ask (scoped to the visible month, by the host), hold → voice entry
 * (`useVoiceEntry`) → the host opens the Entry sheet with the parse as
 * `prefill`.
 *
 * Placement: the host gives the Calendar body a bottom band of `ORB_RESERVE`
 * (plus `barInset`) and renders this dock in it, so the orb sits just above
 * the ＋ and never covers the grid, the day list or the tab bar. `barInset`
 * exists because the custom bar's tab layers are `absoluteFill` and run
 * underneath the floating bar (TabSwitcher's paddingBottom does not reach
 * them); on iOS the native Scene already ends at the bar, so it is 0.
 * - Web / Android (custom `TabBar`): the ＋ sits between two tabs whose labels
 *   differ in width, so it is NOT the bar's centre (by ~15 px in Japanese). On
 *   web the dock reads the ＋'s rendered centre from the DOM and shifts by the
 *   difference; elsewhere it centres.
 * - iOS (system `UITabBar`): the ＋ is the search-role glass circle at the
 *   bottom right, so the orb right-aligns over it (`IOS_PLUS_*`, to verify on
 *   device). The host's body already ends at the bar's top there.
 *
 * The partial transcript and the short failure messages show in a bubble just
 * above the orb; it grows upward, so the orb itself never moves.
 */
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useAi } from '../ai/AiProvider';
import type { Locale, ParseContext, ParsedEntry } from '../ai/contract';
import { useVoiceEntry } from '../ai/useVoiceEntry';
import { strings } from '../i18n';
import { shadows, useTheme, Txt } from '../theme';
import { AiOrb } from '../ui/AiOrb';
import { NATIVE_TABS } from './nativeTabs';

/** Orb hit area (pt): a comfortable floating-button target. */
export const ORB_SIZE = 60;
/** Gap between the orb and the content above it / the bar below it. */
const ORB_GAP = 6;
/** Bottom band the host reserves on the Calendar body for the orb. */
export const ORB_RESERVE = ORB_SIZE + ORB_GAP * 2;

/**
 * iOS 26 search-role ＋: a glass circle at the bar's trailing edge. Estimated
 * from Apple's Music/Photos layout (≈48 pt circle, ≈21 pt from the edge);
 * device verification pending.
 */
const IOS_PLUS_EDGE = 21;
const IOS_PLUS_SIZE = 48;
const IOS_ORB_RIGHT = IOS_PLUS_EDGE + (IOS_PLUS_SIZE - ORB_SIZE) / 2;

/** Web only: the ＋'s horizontal offset from the tab bar's centre, from the DOM. */
function useWebFabOffset(enabled: boolean): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    const measure = () => {
      const bar = doc.querySelector('[data-testid="tab-bar"]');
      const fab = bar?.querySelector(`[aria-label="${strings.nav.addEntry}"]`);
      if (!bar || !fab) return;
      const b = bar.getBoundingClientRect();
      const f = fab.getBoundingClientRect();
      const next = Math.round((f.left + f.width / 2 - (b.left + b.width / 2)) * 2) / 2;
      setOffset((cur) => (cur === next ? cur : next));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const bar = doc.querySelector('[data-testid="tab-bar"]');
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const observer = RO && bar ? new RO(measure) : null;
    if (observer && bar) observer.observe(bar);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [enabled]);
  return offset;
}

export interface CalendarOrbProps {
  /** Calendar visible and no sheet open: holds are allowed and kept. */
  active: boolean;
  /** Distance from the dock's container bottom to the top of the tab bar's
   *  reserved band (the custom bar floats over the tab body; 0 on iOS). */
  barInset: number;
  locale: Locale;
  parseContext: () => ParseContext;
  onAsk: () => void;
  onParsed: (entry: ParsedEntry) => void;
}

export function CalendarOrb({ active, barInset, locale, parseContext, onAsk, onParsed }: CalendarOrbProps) {
  const { ai } = useAi();
  const { colors } = useTheme();
  const voice = useVoiceEntry({ ai, locale, parseContext, onParsed, active });
  const fabOffset = useWebFabOffset(!NATIVE_TABS);

  const bubble =
    voice.phase === 'listen'
      ? { text: voice.partial || strings.ai.orb.listening, placeholder: !voice.partial }
      : voice.phase === 'think'
        ? { text: voice.partial || strings.ai.orb.reading, placeholder: !voice.partial }
        : voice.message
          ? { text: voice.message, placeholder: false }
          : null;

  return (
    <View
      testID="ai-orb-dock"
      pointerEvents="box-none"
      style={[
        styles.dock,
        { bottom: barInset + ORB_GAP },
        NATIVE_TABS
          ? { right: IOS_ORB_RIGHT, alignItems: 'flex-end' }
          : { left: 0, right: 0, alignItems: 'center', transform: [{ translateX: fabOffset }] },
      ]}
    >
      {bubble && (
        <View
          testID="ai-orb-bubble"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={bubble.text}
          style={[
            styles.bubble,
            shadows.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Txt variant="optionLabel" tone={bubble.placeholder ? 'dim' : 'ink'} numberOfLines={2}>
            {bubble.text}
          </Txt>
        </View>
      )}
      <AiOrb
        testID="ai-orb"
        size={ORB_SIZE}
        state={voice.phase}
        level={voice.level}
        onPress={onAsk}
        onLongPress={voice.start}
        onPressOut={voice.release}
        accessibilityLabel={strings.ai.orb.label}
        accessibilityHint={strings.ai.orb.hint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', gap: 8 },
  bubble: {
    maxWidth: 280,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
