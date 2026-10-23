/**
 * iOS renderer for `AiOrb` (see that file): the Kodama point sphere in Skia,
 * every frame computed in a worklet on the UI thread so it never competes with
 * speech recognition or JS.
 *
 * Time only advances while listening or thinking (a frame callback that is
 * switched off in idle and under reduced motion), so the idle orb is still:
 * ADR-0003 forbids idle motion.
 */
import { Canvas, Points } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { useMotion, useTheme, withAppSpring, withAppTiming } from '../theme';
import { OrbShell, fibonacciSphere, projectOrb, type AiOrbProps } from './AiOrb';

const N = 150;

export function AiOrbSkia(props: AiOrbProps) {
  const { size, state, level } = props;
  const { colors } = useTheme();
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
    clock.setActive(enabled && state !== 'idle');
  }, [clock, enabled, state]);

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

  return (
    <OrbShell {...props}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Points points={back} mode="points" color={colors.ink} opacity={0.28} strokeWidth={1.4} strokeCap="round" />
        <Points points={mid} mode="points" color={colors.ink} opacity={0.5} strokeWidth={1.8} strokeCap="round" />
        <Points points={front} mode="points" color={colors.ink} opacity={0.85} strokeWidth={2.2} strokeCap="round" />
        <Points points={glow} mode="points" color={colors.positive} opacity={0.95} strokeWidth={2.8} strokeCap="round" />
      </Canvas>
    </OrbShell>
  );
}
