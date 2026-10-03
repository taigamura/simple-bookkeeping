/**
 * TabBar — the floating Liquid Glass bar (Apple's iOS-26 toolbar model, adopted
 * for decision 3's two tabs + center ＋). Two tabs (Calendar · Summary) flank a
 * solid accent ＋ that opens the Entry sheet. No react-navigation: it reflects/
 * sets the root's `tab` and fires `onAdd`. Tabs use Feather calendar + bar-chart;
 * the ＋ uses plus (decision 6).
 *
 * ## The glass is the OS material, not a fake
 *
 * Real Liquid Glass — the refraction and the chromatic aberration you see on the
 * selected pill in Reddit's iOS bar (and that Apple's HIG describes) — is a GPU
 * material that samples and bends the content behind it. It cannot be painted
 * with a gradient or an SVG rim; earlier attempts to fake it were wrong. So on
 * iOS 26 this uses the actual system material via `expo-glass-effect`'s
 * `GlassView`:
 *
 *  - The **bar** is a `regular` glass surface.
 *  - The **selection lens** is a `clear`, `isInteractive` glass capsule — the
 *    interactive flag is what gives it the touch-driven lensing/aberration from
 *    the reference drag frame. It slides between the two tabs.
 *
 * `isLiquidGlassAvailable()` is false off iOS 26 (web, Android, older iOS), where
 * `GlassView` degrades to a plain `View`. So on those platforms we render our own
 * approximation instead — a transparent, extra-frosted `expo-blur` lens with a
 * specular top and a soft edge. It is explicitly NOT the real material (no
 * refraction, no aberration); it is the best a non-GPU-glass platform can do, and
 * it is what the web verify build shows. The genuine effect only appears in the
 * iOS build.
 *
 * ## Layout & motion
 *
 * The bar floats: an absolute, `box-none` wrapper lets taps fall through its
 * transparent margins; the capsule is lifted off the bottom by the safe-area
 * inset plus a margin; Root's tab body reserves the space so nothing hides behind
 * it. The lens is ONE shared element that slides (a spring `translateX`, easing
 * its width) between the two tabs' measured frames — each tab's own frame, since
 * the labels make them unequal widths — and is vertically centred on the tab. The
 * two tabs report their frames via `onLayout` → `onMeasure`; the row carries no
 * horizontal padding (the capsule does) so a tab's measured `x` and the lens's
 * `left` share one coordinate origin.
 *
 * The ＋ stays a solid accent tile (never glassed, only a thin gloss).
 *
 * ## Tab icon motion
 *
 * Each tab draws its icon twice — `dim` and `positive` — stacked and cross-faded
 * on `opacity`, with a one-shot scale bump on the becoming-active icon. The bump
 * is an additive delta resting at 0, not an absolute scale resting at 1, because
 * `withSequence` resolves to `0` under the reanimated jest mock.
 */
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { strings } from '../i18n';
import {
  useTheme,
  useMotion,
  metrics,
  springs,
  glowFor,
  shadows,
  withAppSequence,
  withAppSpring,
  Txt,
  type ThemeMode,
} from '../theme';
import { PressScale } from '../ui';
import type { Tab } from './types';

/** True only where the OS provides the real Liquid Glass material (iOS 26+). */
const NATIVE_GLASS = isLiquidGlassAvailable();

interface TabBarProps {
  tab: Tab;
  onSelect: (tab: Tab) => void;
  onAdd: () => void;
}

interface TabDef {
  key: Tab;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}

const TABS: TabDef[] = [
  { key: 'calendar', label: strings.nav.calendar, icon: 'calendar' },
  { key: 'summary', label: strings.nav.summary, icon: 'bar-chart-2' },
];

/** A tab's onLayout frame, in the row's coordinates. */
interface TabFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sameFrame(a: TabFrame, b: TabFrame): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Horizontal inset of the lens inside a tab's frame, and its fixed height. The
 *  height nearly fills the bar's interior (the ＋ tile is 54) so the selected
 *  pill reads as a sibling of the ＋, not a short chip. Same on every platform —
 *  the OS glass and the fallback share this geometry. */
const LENS_INSET = 6;
const LENS_HEIGHT = 54;

/**
 * Material recipe. `tintColor` feeds the native `GlassView`; the rest are the
 * fallback (`expo-blur`) approximation used off iOS 26.
 */
function glass(mode: ThemeMode, accent: string) {
  const dark = mode === 'dark';
  return {
    scheme: mode,
    tint: dark ? ('dark' as const) : ('light' as const),
    // A faint accent so the native selection lens reads as "selected".
    lensTint: hexA(accent, dark ? 0.22 : 0.14),
    // ---- fallback (non-iOS-26) ----
    barIntensity: Platform.OS === 'ios' ? 55 : 40,
    barFill: dark ? 'rgba(28,30,38,0.42)' : 'rgba(252,252,254,0.55)',
    barEdge: dark ? 'rgba(255,255,255,0.14)' : 'rgba(20,22,32,0.10)',
    barSheen: dark
      ? (['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'] as const)
      : (['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as const),
    lensBlur: Platform.OS === 'ios' ? 22 : 16,
    lensFill: hexA(accent, dark ? 0.16 : 0.1),
    lensEdge: dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)',
    lensSpecular: dark
      ? (['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'] as const)
      : (['rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'] as const),
    lensDepth: ['rgba(8,10,22,0)', dark ? 'rgba(0,0,0,0.28)' : 'rgba(8,10,22,0.14)'] as const,
  };
}

/** #RRGGBB + alpha → rgba(). Accent tokens are all 6-digit hex. */
function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function TabBar({ tab, onSelect, onAdd }: TabBarProps) {
  const { colors, mode } = useTheme();
  const { enabled } = useMotion();
  const insets = useSafeAreaInsets();
  const g = glass(mode, colors.positive);

  // Measured tab frames (row coordinates). The tabs are NOT equal width — the
  // labels differ ("Calendar" vs "Summary", カレンダー vs 集計) — so the lens takes
  // each tab's own x and width, never tab 0's width for both.
  const frames = useRef<(TabFrame | undefined)[]>([]);
  const [geo, setGeo] = useState<[TabFrame, TabFrame] | null>(null);

  const onMeasure = (index: number, frame: TabFrame) => {
    frames.current[index] = frame;
    const [a, b] = frames.current;
    if (a && b) {
      setGeo((prev) => (prev && sameFrame(prev[0], a) && sameFrame(prev[1], b) ? prev : [a, b]));
    }
  };

  // Traveling selection: 0 = Calendar, 1 = Summary. Springs on tab change so the
  // lens slides between the two tab frames. No scale pulse — the pill keeps a
  // constant height; it only moves (and eases its width between the tabs').
  const selection = useSharedValue(tab === 'summary' ? 1 : 0);

  useEffect(() => {
    const target = tab === 'summary' ? 1 : 0;
    selection.value = enabled ? withAppSpring(target, springs.slide) : target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, enabled]);

  const lensStyle = useAnimatedStyle(() => {
    if (!geo) return {};
    const [a, b] = geo;
    const t = selection.value;
    return {
      width: a.width + (b.width - a.width) * t - LENS_INSET * 2,
      transform: [{ translateX: (b.x - a.x) * t }],
    };
  });

  return (
    // box-none: the capsule captures its own touches; the empty margins on either
    // side let taps fall through to the content beneath the floating bar.
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { bottom: insets.bottom + metrics.tabBarFloatMargin }]}
    >
      {/* Shadow on its own node (no overflow) so iOS doesn't clip it. */}
      <View testID="tab-bar" style={styles.float}>
        <View style={[styles.capsule, NATIVE_GLASS ? null : { borderColor: g.barEdge }]}>
          {/* Bar material. */}
          {NATIVE_GLASS ? (
            <GlassView
              glassEffectStyle="regular"
              colorScheme={g.scheme}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <>
              <BlurView intensity={g.barIntensity} tint={g.tint} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: g.barFill }]} />
              <LinearGradient
                colors={g.barSheen}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                locations={[0, 0.55]}
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
              />
            </>
          )}

          <View style={styles.row}>
            {/* One shared selection lens, behind the glyphs, sliding between tabs. */}
            {geo && (
              <Animated.View
                testID="tab-lens"
                style={[
                  styles.lens,
                  {
                    left: geo[0].x + LENS_INSET,
                    // Centre on the tab's own frame: an absolute child's `top` is
                    // measured from the row's padding edge, so `top: 0` would ride
                    // the row's paddingVertical above the tabs and the ＋.
                    top: geo[0].y + (geo[0].height - LENS_HEIGHT) / 2,
                    height: LENS_HEIGHT,
                  },
                  lensStyle,
                ]}
                pointerEvents="none"
              >
                <View style={styles.lensClip}>
                  {NATIVE_GLASS ? (
                    // The real material: refraction + chromatic aberration, and
                    // the interactive lensing on touch (the reference drag frame).
                    <GlassView
                      glassEffectStyle="clear"
                      colorScheme={g.scheme}
                      tintColor={g.lensTint}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : (
                    // Fallback approximation: a transparent extra-frost with a
                    // specular top and soft edge. Not the real material.
                    <View style={[styles.lensFallback, { borderColor: g.lensEdge }]}>
                      <BlurView
                        intensity={g.lensBlur}
                        tint={g.tint}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: g.lensFill }]} />
                      <LinearGradient
                        colors={g.lensSpecular}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        locations={[0, 0.42]}
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={g.lensDepth}
                        start={{ x: 0, y: 0.55 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            <TabButton
              def={TABS[0]}
              index={0}
              active={tab === 'calendar'}
              onPress={onSelect}
              onMeasure={onMeasure}
            />

            <PressScale
              scale="control"
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={strings.nav.addEntry}
              style={({ pressed }) => [
                styles.fab,
                glowFor(colors.positive),
                { backgroundColor: colors.positive, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)'] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                locations={[0, 0.6]}
                pointerEvents="none"
                style={styles.fabGloss}
              />
              <Feather name="plus" size={24} color={colors.onPositive} />
            </PressScale>

            <TabButton
              def={TABS[1]}
              index={1}
              active={tab === 'summary'}
              onPress={onSelect}
              onMeasure={onMeasure}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function TabButton({
  def,
  index,
  active,
  onPress,
  onMeasure,
}: {
  def: TabDef;
  index: number;
  active: boolean;
  onPress: (tab: Tab) => void;
  onMeasure: (index: number, frame: TabFrame) => void;
}) {
  const { colors } = useTheme();
  const { enabled } = useMotion();

  const colorProgress = useSharedValue(active ? 1 : 0);
  const bump = useSharedValue(0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (!enabled) {
      colorProgress.value = active ? 1 : 0;
      wasActive.current = active;
      return;
    }
    colorProgress.value = withAppSpring(active ? 1 : 0, springs.snap);
    if (active && !wasActive.current) {
      bump.value = withAppSequence(
        withAppSpring(0.15, springs.pop),
        withAppSpring(0, springs.press),
      );
    }
    wasActive.current = active;
  }, [active, enabled, colorProgress, bump]);

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: colorProgress.value,
    transform: [{ scale: 1 + bump.value }],
  }));
  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - colorProgress.value,
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    onMeasure(index, { x, y, width, height });
  };

  return (
    <Pressable
      onPress={() => onPress(def.key)}
      onLayout={handleLayout}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={def.label}
      style={styles.tab}
    >
      <View style={styles.iconStack}>
        <Animated.View style={inactiveIconStyle}>
          <Feather name={def.icon} size={20} color={colors.dim} />
        </Animated.View>
        <Animated.View style={[styles.iconStackLayer, activeIconStyle]}>
          <Feather name={def.icon} size={20} color={colors.positive} />
        </Animated.View>
      </View>
      <Txt variant="microLabel" tone={active ? 'positive' : 'dim'} style={styles.tabLabel}>
        {def.label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  float: {
    borderRadius: metrics.pill,
    ...shadows.card,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  capsule: {
    borderRadius: metrics.pill,
    borderWidth: NATIVE_GLASS ? 0 : StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  tabLabel: { marginTop: 1 },
  // The shared selection lens; left/top/height set inline from the measured tab
  // frames, width + translateX animated. Height matches the ＋ tile (54) and it
  // is centred on the tab, so the selected pill sits level with the ＋.
  lens: {
    position: 'absolute',
  },
  lensClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: metrics.pill,
    overflow: 'hidden',
  },
  lensFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: metrics.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  iconStack: { width: 20, height: 20 },
  iconStackLayer: { position: 'absolute', top: 0, left: 0 },
  fab: {
    width: metrics.fabSize,
    height: metrics.fabSize,
    borderRadius: metrics.fabRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  fabGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
});
