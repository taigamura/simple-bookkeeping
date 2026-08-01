/**
 * PressScale — a Pressable that springs inward while held.
 *
 * Kaji's controls previously reported a press by swapping a fill color or
 * dropping opacity. That works, but it is a *state* change: it tells you the
 * button is pressed, not that your touch was received. A scale change is
 * motion, and motion is what reads as acknowledgement — the same reason iOS
 * buttons shrink rather than merely tint.
 *
 * Two sizes of feedback (`pressScale` in theme/motion): small square controls
 * take the bigger factor because a 3% change on a 34px button is invisible,
 * while wide surfaces take the smaller one because the same factor on a
 * full-width CTA looks like the layout is collapsing.
 *
 * The scale is driven from `onPressIn`/`onPressOut` rather than Pressable's
 * `({ pressed })` style callback, because that callback only re-renders on
 * press state changes — it cannot express the *return* journey, so a release
 * would snap back with no animation at all.
 *
 * Callers may still pass the function form of `style` to keep an existing
 * pressed-state tint. It is resolved here against locally-tracked press state
 * and handed to the animated component as a plain array: reanimated has to
 * *see* the animated style inside the `style` prop to attach to it, and a
 * function style is opaque to it (the scale would silently never apply). The
 * extra render this costs is one Pressable would have done anyway for a
 * function style.
 *
 * Under reduced motion the component holds scale 1 and falls back to a plain
 * Pressable with the caller's original style contract untouched.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { pressScale, springs, useMotion, withAppSpring } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressScaleProps extends Omit<PressableProps, 'style'> {
  /**
   * How far to press in. `control` (0.94) for small square targets — keypad
   * keys, icon buttons, the FAB; `surface` (0.98) for wide ones — the CTA,
   * option tiles. Defaults to `control`.
   */
  scale?: keyof typeof pressScale;
  /**
   * Same contract as Pressable's `style`, including the `({ pressed })`
   * function form — so a caller can keep its existing pressed-state tint and
   * gain the scale on top.
   */
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: React.ReactNode;
}

export function PressScale({
  scale = 'control',
  style,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: PressScaleProps) {
  const { enabled } = useMotion();
  const progress = useSharedValue(1);
  const target = pressScale[scale];
  // A disabled control must not appear to respond at all — Pressable swallows
  // the press, but onPressIn still fires on some platforms, so gate here too.
  const animate = enabled && !disabled;

  const [pressed, setPressed] = useState(false);

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      setPressed(true);
      progress.value = withAppSpring(target, springs.press);
      onPressIn?.(event);
    },
    [onPressIn, progress, target],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      setPressed(false);
      progress.value = withAppSpring(1, springs.press);
      onPressOut?.(event);
    },
    [onPressOut, progress],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: progress.value }],
  }));

  if (!animate) {
    return (
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style as PressableProps['style']}
      >
        {children}
      </Pressable>
    );
  }

  const base = typeof style === 'function' ? style({ pressed }) : style;

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[base, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
