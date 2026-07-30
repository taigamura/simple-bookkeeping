/**
 * Design tokens for Kaji — colors, type scale, and layout metrics.
 *
 * Visual direction: "Kippu 切符" (see docs/mockups/README.md). @nemuiasaa's light
 * shell — warm off-white ground, borderless white cards, generous whitespace —
 * carrying mokumono's electric blue and uppercase-mono micro-labels. One
 * saturated `deep` block owns the headline number on Summary.
 *
 * Two families only: system sans for UI copy (fontFamily left unset) and
 * JetBrains Mono for every number + uppercase micro-label.
 *
 * Note: the design expresses tracking in `em`; React Native's `letterSpacing` is
 * absolute px, so each type variant below pre-converts `em * fontSize`.
 */
import type { TextStyle } from 'react-native';

/** The resolved appearance actually rendered. */
export type ThemeMode = 'dark' | 'light';

/**
 * What the user chose in Settings. `system` follows the OS appearance and is
 * resolved to a `ThemeMode` by the provider; the other two pin it.
 */
export type ThemePreference = 'system' | ThemeMode;

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'system',
  'light',
  'dark',
] as const;

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

/**
 * The full color set for one appearance. Accents live here rather than in a
 * shared constant because the blue has to differ between modes: `#2B33E8` is
 * the right weight on white but drops to 2.5:1 against a near-black ground, so
 * dark runs a lifted `#6B72FF` and flips `onPositive` to near-black to keep
 * text on the accent legible. Every pairing below clears WCAG AA (4.5:1).
 */
export interface Colors {
  /** Screen ground. */
  bg: string;
  /** Raised surface — cards, tab bar, sheets. */
  card: string;
  /** Recessed fill — chips, keypad keys, nav buttons, grouped rows. */
  card2: string;
  /** Deeper fill — pressed states, list-row code tiles. */
  card3: string;
  ink: string;
  muted: string;
  dim: string;
  hair: string;
  line: string;
  border: string;
  /** Income, primary CTAs, selection. The one hue the UI carries. */
  positive: string;
  /** Alarm only — over-budget, destructive actions. Never plain expenses. */
  negative: string;
  /** Text/icons on a `positive` surface. */
  onPositive: string;
  /** Text/icons on a `negative` surface. */
  onNegative: string;
  /** The saturated Summary hero block. */
  deep: string;
  /** Text on `deep`. */
  onDeep: string;
  /** Secondary text on `deep` (micro-labels, legend keys). */
  onDeepMuted: string;
}

export const palettes: Record<ThemeMode, Colors> = {
  light: {
    bg: '#F2F2F0',
    card: '#FFFFFF',
    card2: '#F5F5F3',
    card3: '#EAEAE6',
    ink: '#16161A',
    muted: '#65656E',
    // The design specifies #9C9CA4, which is 2.4:1 on the ground — too low for
    // the 10px micro-labels it is used on. Darkened to the lightest value that
    // still clears AA.
    dim: '#6E6E77',
    hair: '#E7E7E3',
    line: 'rgba(22,22,26,.12)',
    border: 'rgba(22,22,26,.08)',
    positive: '#2B33E8',
    negative: '#C93B31',
    onPositive: '#FFFFFF',
    onNegative: '#FFFFFF',
    deep: '#1E2499',
    onDeep: '#FFFFFF',
    onDeepMuted: 'rgba(255,255,255,.80)',
  },
  dark: {
    bg: '#0F0F13',
    card: '#17171D',
    card2: '#1D1D25',
    card3: '#262630',
    ink: '#F0F0F4',
    muted: '#9A9AA6',
    dim: '#82828E',
    hair: 'rgba(255,255,255,.07)',
    line: 'rgba(255,255,255,.12)',
    border: 'rgba(255,255,255,.09)',
    positive: '#6B72FF',
    negative: '#FF6B60',
    // Near-black rather than white: on the lifted blue it reads 5.0:1 where
    // white would only manage 3.8:1.
    onPositive: '#0F0F13',
    onNegative: '#0F0F13',
    // The light mode's accent becomes the dark mode's hero surface.
    deep: '#2B33E8',
    onDeep: '#FFFFFF',
    onDeepMuted: 'rgba(255,255,255,.80)',
  },
};

export const colorsFor = (mode: ThemeMode): Colors => palettes[mode];

/** JetBrains Mono weight → RN fontFamily string (each weight is its own family). */
export const mono = {
  regular: 'JetBrainsMono_400Regular',
  medium: 'JetBrainsMono_500Medium',
  semibold: 'JetBrainsMono_600SemiBold',
  bold: 'JetBrainsMono_700Bold',
} as const;

/**
 * Type scale. Each entry is a ready-to-spread RN TextStyle (minus color, which the
 * Txt component supplies from the active theme). `letterSpacing` is px.
 */
export const type = {
  /** Entry-sheet amount. Size shrinks by digit length — use heroAmountSize(). */
  heroAmount: {
    fontFamily: mono.semibold,
    fontSize: 66,
    letterSpacing: -2.64, // -.04em @ 66
  },
  /** Summary net figure. */
  summaryNet: {
    fontFamily: mono.bold,
    fontSize: 40,
    letterSpacing: -1.2, // -.03em @ 40
  },
  /** Screen title (sans). */
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.48, // -.02em @ 24
  },
  /** List item / category label (sans). */
  listItem: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  /** Secondary / note copy (sans). */
  secondary: {
    fontSize: 12,
    fontWeight: '500',
  },
  /** Option-row label (sans) — Entry/Settings grouped rows. */
  optionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  /** Section micro-label — uppercase mono with wide tracking. */
  microLabel: {
    fontFamily: mono.semibold,
    fontSize: 10.5,
    letterSpacing: 1.47, // +.14em @ 10.5
    textTransform: 'uppercase',
  },
  /** Inline amount within a row (mono). */
  inlineAmount: {
    fontFamily: mono.semibold,
    fontSize: 14,
  },
  /** Calendar day number (mono). */
  calendarDay: {
    fontFamily: mono.semibold,
    fontSize: 13,
  },
  /** Calendar per-day total (mono, tiny). */
  calendarDayTotal: {
    fontFamily: mono.semibold,
    fontSize: 8.5,
  },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/**
 * Hero amount font size shrinks as the number grows so long amounts still fit.
 * Mirrors the prototype's length-based step-down (66 → 58 → 46).
 */
export const heroAmountSize = (text: string): number => {
  const len = text.length;
  if (len <= 6) return 66;
  if (len <= 9) return 58;
  return 46;
};

/**
 * Layout & shape metrics (px).
 *
 * Kippu's shape language is soft-filled rounded rectangles, not outlined pills:
 * only progress tracks stay fully round. Radii below come from the design doc.
 */
export const metrics = {
  screenPadX: 20,
  statusOffset: 52, // → SafeArea top inset on native
  cardRadius: 20,
  /** The Summary hero block and the Entry sheet's grouped rows card. */
  heroRadius: 20,
  sheetRadius: 26, // top corners only
  pill: 999,
  chipRadius: 9,
  keypadKeyRadius: 12,
  iconTileRadius: 9,
  dayCellRadius: 8,
  dayCellHeight: 46,
  segRadius: 12,
  segItemRadius: 9,
  /** Progress tracks and the split bar stay fully round. */
  progressRadius: 999,
  progressHeight: 8,
  tabBarHeight: 92,
  keypadCols: 3,
  keypadGap: 9,
  keypadKeySize: 52,
  navButton: 34,
  navButtonRadius: 10,
  fabSize: 54,
  fabRadius: 16,
  ctaHeight: 54,
  ctaRadius: 14,
  /** Web only: center the app in a phone-width container (decision 10). */
  webMaxWidth: 402,
} as const;

/**
 * Card lift. Retuned for a light ground — the previous values were a heavy
 * black bloom sized for the near-black theme and read as dirt on off-white.
 */
export const shadows = {
  card: {
    shadowColor: '#141820',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
} as const;

/**
 * Accent glow for the CTA and the ＋ FAB. Takes the active accent so the blue
 * tracks the theme rather than being frozen at the light value.
 */
export const glowFor = (color: string) =>
  ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  }) as const;
