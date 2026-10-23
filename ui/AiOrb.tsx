/**
 * AiOrb — the Calendar's Suito AI button (PRD #145): a small sphere of ink
 * points, ported from voice-memo's 木霊 (Kodama) RecordOrb.
 *
 * - `idle`: a still sphere on a raised disc. ADR-0003 (nothing plays on idle)
 *   and ADR-0006 (no looping mascots) both apply, so idle never turns.
 * - `listen`: the mic level scatters the points outward, a few glow in the
 *   accent, and the disc takes an accent ring.
 * - `think`: the points gather into latitude rings (orbiting on iOS) while the
 *   transcript is read; the ring stays, at half strength.
 *
 * Two renderers share these props and the geometry in `projectOrb`:
 * - iOS: Skia + Reanimated (`AiOrbSkia`), every frame on the UI thread.
 * - Web and Jest: a static stand-in made of plain Views (Skia needs CanvasKit on
 *   web; the jest preset has no Skia). It re-renders per level event, so the
 *   scatter is still visible in screenshots, and it publishes the state as
 *   `accessibilityValue.text` (`aria-valuetext` on web) for tests.
 *
 * Reduced motion (`useMotion().enabled === false`): the end state of each
 * phase, no scatter, no spin. The ring and accent points still say "listening".
 */
import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { shadows, useMotion, useTheme } from '../theme';

export type OrbState = 'idle' | 'listen' | 'think';

export interface AiOrbProps {
  /** Hit area (square, pt). The disc and sphere scale from it. */
  size: number;
  state: OrbState;
  /** 0..1 mic level; only read while listening. */
  level: number;
  onPress?: () => void;
  /** Fires after `delayLongPress` (250 ms): start listening. */
  onLongPress?: () => void;
  /** Every release, tap or hold. */
  onPressOut?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export const LONG_PRESS_MS = 250;
/** Disc diameter as a share of the hit area. */
export const DISC_RATIO = 0.86;

// ---------------------------------------------------------------- geometry

export interface Seed {
  x: number;
  y: number;
  z: number;
  /** Per-point pseudo-random 0..1. */
  k: number;
}

export function fibonacciSphere(n: number): Seed[] {
  const out: Seed[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    // Deterministic, so the sphere looks the same every launch (and every screenshot).
    const k = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    out.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, k: Math.abs(k) });
  }
  return out;
}

export interface OrbFrameInput {
  /** Seconds of animated time (frozen while idle). */
  t: number;
  /** 0..1 blend into listening. */
  rec: number;
  /** 0..1 blend into rings. */
  think: number;
  /** 0..1 mic level, already gated by state and reduced motion. */
  level: number;
  size: number;
}

export interface OrbPoint {
  x: number;
  y: number;
}

export interface OrbFrame {
  /** Back, middle, front depth buckets (drawn with rising opacity). */
  buckets: [OrbPoint[], OrbPoint[], OrbPoint[]];
  /** Accent points (listening / thinking only). */
  accent: OrbPoint[];
}

export const ACCENT_EVERY = 11;

/** One frame of the sphere. Pure, and a worklet so Skia runs it on the UI thread. */
export function projectOrb(seeds: Seed[], { t, rec, think, level, size }: OrbFrameInput): OrbFrame {
  'worklet';
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.27;
  const rot = 0.6 + t * (0.25 + think * 0.65);
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const ct = Math.cos(0.35);
  const st = Math.sin(0.35);
  const buckets: [OrbPoint[], OrbPoint[], OrbPoint[]] = [[], [], []];
  const accent: OrbPoint[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    let x = s.x;
    let y = s.y;
    let z = s.z;
    if (think > 0.001) {
      // Gather into 5 latitude rings that orbit at different speeds.
      const ring = Math.round(s.y * 2) / 2;
      const ry = ring * 0.8;
      const rr = Math.sqrt(Math.max(0, 1 - ring * ring * 0.64));
      const ang = Math.atan2(s.z, s.x) + t * (1 + ring);
      x = x * (1 - think) + Math.cos(ang) * rr * think;
      y = y * (1 - think) + ry * think;
      z = z * (1 - think) + Math.sin(ang) * rr * think;
    }
    const X = x * ca + z * sa;
    let Z = -x * sa + z * ca;
    const Y = y * ct - Z * st;
    Z = y * st + Z * ct;
    const scatter = 1 + level * 0.45 * (0.4 + s.k) * (0.6 + 0.4 * Math.sin(t * 6 + s.k * 20));
    const push = 1 * (1 - rec) + scatter * rec;
    const persp = 1 / (1.9 - Z * 0.6);
    const p = { x: cx + X * R * push * persp * 1.6, y: cy + Y * R * push * persp * 1.6 };
    if ((rec > 0.5 || think > 0.5) && i % ACCENT_EVERY === 0) {
      accent.push(p);
      continue;
    }
    const b = Math.min(2, Math.floor(((Z + 1) / 2) * 3));
    buckets[b].push(p);
  }
  return { buckets, accent };
}

// ---------------------------------------------------------------- component

/**
 * The Skia renderer is required lazily and only on native outside Jest, so
 * neither the web bundle (a `.web` stub) nor the test environment loads Skia.
 */
const SkiaOrb: React.ComponentType<AiOrbProps> | null =
  Platform.OS !== 'web' && process.env.NODE_ENV !== 'test'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./AiOrbSkia') as typeof import('./AiOrbSkia')).AiOrbSkia
    : null;

export function AiOrb(props: AiOrbProps) {
  if (SkiaOrb) return <SkiaOrb {...props} />;
  return <AiOrbStatic {...props} />;
}

/** Stand-in point count: enough to read as a sphere at ~52 px, cheap as Views. */
const STATIC_N = 72;

/** Pressable shell shared by both renderers: disc, ring, scale, a11y. */
export function OrbShell({
  size,
  state,
  onPress,
  onLongPress,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  children,
}: AiOrbProps & { children: React.ReactNode }) {
  const { colors, mode } = useTheme();
  const disc = Math.round(size * DISC_RATIO);
  const active = state !== 'idle';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      delayLongPress={LONG_PRESS_MS}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: state === 'think' }}
      accessibilityValue={{ text: state }}
      // react-native-web drops `accessibilityValue`; this reaches the DOM as aria-valuetext.
      aria-valuetext={state}
      testID={testID}
      style={({ pressed }) => [
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        // Static scale per state (no tween): listening reads as "lifted".
        { transform: [{ scale: pressed && !active ? 0.94 : state === 'listen' ? 1.08 : 1 }] },
        style,
      ]}
    >
      <View
        testID={testID ? `${testID}-disc` : undefined}
        pointerEvents="none"
        style={[
          styles.disc,
          shadows.card,
          {
            width: disc,
            height: disc,
            borderRadius: disc / 2,
            backgroundColor: colors.card,
            borderColor: active ? colors.positive : colors.border,
            borderWidth: active ? 2 : StyleSheet.hairlineWidth,
            opacity: 1,
            shadowOpacity: mode === 'dark' ? 0.4 : 0.14,
          },
        ]}
      >
        {state === 'think' && (
          // A second, half-strength ring inset in the disc while reading.
          <View
            testID={testID ? `${testID}-ring` : undefined}
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: disc / 2, borderWidth: 2, borderColor: colors.positive, opacity: 0.35, margin: 3 },
            ]}
          />
        )}
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </Pressable>
  );
}

/** Web/Jest renderer: same geometry, drawn once per render with plain Views. */
export function AiOrbStatic(props: AiOrbProps) {
  const { size, state, level } = props;
  const { colors } = useTheme();
  const { enabled } = useMotion();
  const seeds = useMemo(() => fibonacciSphere(STATIC_N), []);
  const frame = useMemo(
    () =>
      projectOrb(seeds, {
        // Frozen time: the stand-in never spins, only scatters per level event.
        t: 0,
        rec: state === 'listen' ? 1 : 0,
        think: state === 'think' ? 1 : 0,
        level: state === 'listen' && enabled ? Math.max(0, Math.min(1, level)) : 0,
        size,
      }),
    [seeds, state, level, enabled, size],
  );
  const dot = (p: OrbPoint, d: number, color: string, opacity: number, key: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: p.x - d / 2,
        top: p.y - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );
  return (
    <OrbShell {...props}>
      {frame.buckets[0].map((p, i) => dot(p, 1.6, colors.ink, 0.28, `b${i}`))}
      {frame.buckets[1].map((p, i) => dot(p, 2, colors.ink, 0.5, `m${i}`))}
      {frame.buckets[2].map((p, i) => dot(p, 2.4, colors.ink, 0.85, `f${i}`))}
      {frame.accent.map((p, i) => dot(p, 2.8, colors.positive, 0.95, `a${i}`))}
    </OrbShell>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
});
