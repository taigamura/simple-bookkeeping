/**
 * SegmentedToggle — a rounded 2+ option switch (Expense/Income in the Entry
 * sheet). Generic over the option value; the active segment fills with
 * `activeColor` (the theme accent by default) and its label flips to
 * `activeTone`.
 *
 * Used to give each item its own conditional background, so switching
 * Expense↔Income was one fill disappearing and a different one appearing a
 * beat later — visually two events, even though it's one choice. It's now a
 * single accent pill, absolutely positioned under the row of items, that
 * springs (`springs.snap`) from one segment's slot to the other's — one
 * element, one motion, matching what a physical switch does.
 *
 * The pill's slot is computed from the *measured* track width (`onLayout`),
 * not a hardcoded item width, because this component is generic over however
 * many options a caller passes it. Two situations can't measure before first
 * paint — the real first frame on a real device, and every render inside the
 * jsdom test environment, where `onLayout` never fires at all — and both need
 * to look correct with zero animation, not just eventually converge to
 * correct once a spring lands. So until `trackWidth` is known this renders
 * the plain, un-animated backgroundColor-on-the-active-item that the old
 * implementation used, which is trivially correct on the very first frame and
 * is exactly what a snapshot taken under jsdom sees.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { strings } from '../i18n';
import { useTheme, useMotion, metrics, springs, withAppSpring, Txt, type Tone } from '../theme';

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
  const { enabled } = useMotion();
  const fill = activeColor ?? colors.positive;
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );
  const step = trackWidth / options.length;

  const pillX = useSharedValue(activeIndex * step);

  useEffect(() => {
    if (trackWidth === 0) return;
    pillX.value = enabled
      ? withAppSpring(activeIndex * step, springs.snap)
      : activeIndex * step;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, step, trackWidth, enabled]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const onTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={[styles.track, { backgroundColor: colors.card2 }]}
      onLayout={onTrackLayout}
    >
      {trackWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { width: step, backgroundColor: fill }, pillStyle]}
        />
      )}
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
            // Below trackWidth-measured, this instant fill is the only
            // indicator of selection — see file header. Once the sliding
            // pill takes over, this stays undefined so the two never fight.
            style={[styles.item, trackWidth === 0 && active && { backgroundColor: fill }]}
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
  pill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: metrics.segItemRadius,
  },
});
