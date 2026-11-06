/**
 * iOS renderer for `AiOrb` (see that file): the Kodama point sphere in Skia,
 * every frame computed in a worklet on the UI thread so it never competes with
 * speech recognition or JS.
 *
 * Time always advances while motion is on, so the idle orb turns, bobs and
 * breathes like voice-memo's (ADR-0003 amendment 2026-10-23). Under reduced
 * motion the frame callback is off and the sphere holds still.
 */
import { Canvas, Circle, Group, Points, RadialGradient, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { useMotion, useTheme, withAppSpring, withAppTiming } from '../theme';
import { OrbShell, fibonacciSphere, projectOrb, type AiOrbProps } from './AiOrb';

const N = 150;

export function AiOrbSkia(props: AiOrbProps) {
  const { size, state, level } = props;
  const { colors, mode } = useTheme();
  const { enabled } = useMotion();
  const seeds = useMemo(() => fibonacciSphere(N), []);

  const time = useSharedValue(0);
  const lv = useSharedValue(0);
  const rec = useSharedValue(state === 'listen' ? 1 : 0);
  const think = useSharedValue(state === 'think' ? 1 : 0);

  const clock = useFrameCallback((info) => {
    time.value += (info.timeSincePreviousFrame ?? 16) / 1000;
  }, false);

  useEffect(() => {
    clock.setActive(enabled);
  }, [clock, enabled]);

  useEffect(() => {
    const target = state === 'listen' && enabled ? Math.max(0, Math.min(1, level)) : 0;
    lv.value = enabled ? withAppTiming(target, { duration: 90 }) : target;
  }, [level, state, enabled, lv]);

  useEffect(() => {
    const r = state === 'listen' ? 1 : 0;
    const k = state === 'think' ? 1 : 0;
    if (enabled) {
      rec.value = withAppSpring(r, { damping: 18, stiffness: 120 });
      think.value = withAppTiming(k, { duration: 600 });
    } else {
      rec.value = r;
      think.value = k;
    }
  }, [state, enabled, rec, think]);

  const frame = useDerivedValue(() =>
    projectOrb(seeds, { t: time.value, rec: rec.value, think: think.value, level: lv.value, size }),
  );
  const back = useDerivedValue(() => frame.value.buckets[0]);
  const mid = useDerivedValue(() => frame.value.buckets[1]);
  const front = useDerivedValue(() => frame.value.buckets[2]);
  const glow = useDerivedValue(() => frame.value.accent);

  // voice-memo's ground shadow: a squashed radial fade under the sphere that
  // swells a little with the voice.
  const R = size * 0.27;
  const shadowC = vec(size / 2, size / 2 + R * 1.35);
  const shadowR = useDerivedValue(() => R * (0.9 + lv.value * 0.15));
  const shade = mode === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(28,28,28,0.09)';

  return (
    <OrbShell {...props} shadow={false}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ scaleY: 0.22 }]} origin={shadowC}>
          <Circle c={shadowC} r={shadowR}>
            <RadialGradient c={shadowC} r={shadowR} colors={[shade, 'rgba(0,0,0,0)']} />
          </Circle>
        </Group>
        <Points points={back} mode="points" color={colors.ink} opacity={0.28} strokeWidth={1.4} strokeCap="round" />
        <Points points={mid} mode="points" color={colors.ink} opacity={0.5} strokeWidth={1.8} strokeCap="round" />
        <Points points={front} mode="points" color={colors.ink} opacity={0.85} strokeWidth={2.2} strokeCap="round" />
        <Points points={glow} mode="points" color={colors.positive} opacity={0.95} strokeWidth={2.8} strokeCap="round" />
      </Canvas>
    </OrbShell>
  );
}
