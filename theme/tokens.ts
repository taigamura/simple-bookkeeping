/**
 * Design tokens for Kaji — colors, type scale, and layout metrics.
 *
 * Ported verbatim from the "Kaji" design concept (see docs/build-decisions.md
 * "Design tokens"). Two families only: system sans for UI copy (fontFamily left
 * unset) and JetBrains Mono for every number + uppercase micro-label.
 *
 * Note: the design expresses tracking in `em`; React Native's `letterSpacing` is
 * absolute px, so each type variant below pre-converts `em * fontSize`.
 */
import type { TextStyle } from 'react-native';

export type ThemeMode = 'dark' | 'light';

/** Theme-dependent color palette (surfaces + text + separators). */
export interface Palette {
  bg: string;
  card: string;
  card2: string;
  card3: string;
  ink: string;
  muted: string;
  dim: string;
  hair: string;
  line: string;
  border: string;
}

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    bg: '#0E1116',
    card: '#171B22',
    card2: '#1A1F28',
    card3: '#242B35',
    ink: '#EAEEF3',
    muted: '#9AA4B2',
    dim: '#6B7480',
    hair: 'rgba(255,255,255,.06)',
    line: 'rgba(255,255,255,.10)',
    border: 'rgba(255,255,255,.08)',
  },
  light: {
    bg: '#EEF1F5',
    card: '#FFFFFF',
    card2: '#F4F6F8',
    card3: '#E4E9EE',
    ink: '#141820',
    muted: '#5A6472',
    dim: '#98A2AE',
    hair: 'rgba(20,24,31,.07)',
    line: 'rgba(20,24,31,.12)',
    border: 'rgba(20,24,31,.08)',
  },
};

/**
 * Accents are shared across themes. On-green text/icons use near-black
 * (`onPositive`), never white.
 */
export const accents = {
  positive: '#2BD48A', // income, primary CTAs, selection
  negative: '#F0766C', // expense, delete
  onPositive: '#0B0E12', // text/icon rendered on a positive-green surface
} as const;

/** Full color set for a given theme mode: palette + shared accents. */
export type Colors = Palette & typeof accents;

export const colorsFor = (mode: ThemeMode): Colors => ({
  ...palettes[mode],
  ...accents,
});

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

/** Layout & shape metrics (px). See build-decisions "Layout & shape metrics". */
export const metrics = {
  screenPadX: 20,
  statusOffset: 52, // → SafeArea top inset on native
  cardRadius: 18, // design range 16–20
  sheetRadius: 26, // top corners only
  pill: 999,
  keypadKeyRadius: 15,
  iconTileRadius: 10, // range 9–11
  dayCellRadius: 11,
  dayCellHeight: 46,
  progressRadius: 6,
  progressHeight: 8,
  tabBarHeight: 92,
  keypadCols: 3,
  keypadGap: 9,
  keypadKeySize: 52,
  navButton: 34, // round nav buttons
  ctaHeight: 54,
  ctaRadius: 16,
  /** Web only: center the app in a phone-width container (decision 10). */
  webMaxWidth: 402,
  /** Reserve space at list bottom for the free-tier ad slot (decision 7). */
  adReserve: 72,
} as const;

/** Shadows are theme-independent in the design (tuned for dark). */
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaGlow: {
    shadowColor: accents.positive,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 24,
    elevation: 8,
  },
  /** Center ＋ FAB green glow (design: `0 8 22 rgba(43,212,138,.32)`). */
  fabGlow: {
    shadowColor: accents.positive,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 10,
  },
} as const;
