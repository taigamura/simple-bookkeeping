/**
 * Keypad — a compact 4-column entry calculator with digits, `00`, arithmetic operators,
 * clear, equals, and ⌫. It is presentational: each press reports a `KeypadKey`
 * and the parent applies `pressKey` from the domain.
 *
 * Every key is a `PressScale` (`control` — these are small square targets, the
 * case that scale factor is tuned for) rather than a plain `Pressable`. The
 * pad is the single most-tapped surface in the app, so it is also the surface
 * where a felt response matters most: eighteen keys getting struck in quick
 * succession while entering an amount should each read as received. The
 * existing `pressed`→`card3` background swap stays exactly as it was — it is
 * cheap, instant, and gives the key a second cue (fill) on top of the new
 * scale, which is what makes a very fast tap-tap-tap still legible per key.
 *
 * ## Compact sizing
 *
 * The pad is the tallest single block in the Entry sheet (~296px of a ~760px
 * form), so it is the first thing that has to give when the sheet is opened on
 * a short screen. `scale` shrinks the key height, the row gap and the glyph —
 * but **not** below `MIN_KEY_HEIGHT`. A key that keeps shrinking to fit
 * eventually becomes a key you cannot reliably hit, and a calculator you
 * mis-tap is worse than one you have to scroll to; the Entry sheet takes the
 * remainder as scroll rather than asking for more here.
 *
 * Key *width* is untouched: it is a percentage of the row, so keys stay wide
 * targets even at the floor, and the 4-column grid never reflows.
 */
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { KeypadKey } from '../domain';
import { strings } from '../i18n';
import { keypadTap } from '../platform/haptics';
import { useTheme, metrics, Txt } from '../theme';
import { PressScale } from './PressScale';

const KEYS: KeypadKey[] = [
  'clear', 'divide', 'multiply', 'del',
  '7', '8', '9', 'subtract',
  '4', '5', '6', 'add',
  '1', '2', '3', 'equals',
  '00', '0',
];

const DISPLAY: Partial<Record<KeypadKey, string>> = {
  clear: 'C',
  divide: '÷',
  multiply: '×',
  add: '+',
  subtract: '−',
  equals: '=',
};

/**
 * Smallest key height we will render. iOS asks for 44pt of touch target; keys
 * are ~23% of the sheet width (comfortably past 44 horizontally), so the height
 * is the dimension that matters and this is where it stops.
 */
const MIN_KEY_HEIGHT = 44;

export function Keypad({
  onKey,
  scale = 1,
}: {
  onKey: (key: KeypadKey) => void;
  /** Compact factor in (0, 1] applied to key height, row gap and glyph size. */
  scale?: number;
}) {
  const { colors } = useTheme();
  const keyHeight = Math.max(MIN_KEY_HEIGHT, Math.round(metrics.keypadKeySize * scale));
  const rowGap = Math.max(6, Math.round(metrics.keypadGap * scale));
  const digitSize = Math.max(18, Math.round(22 * scale));
  const iconSize = Math.max(16, Math.round(20 * scale));
  const accessibilityLabels: Partial<Record<KeypadKey, string>> = {
    clear: strings.keypad.clear,
    add: strings.keypad.add,
    subtract: strings.keypad.subtract,
    multiply: strings.keypad.multiply,
    divide: strings.keypad.divide,
    equals: strings.keypad.equals,
    del: strings.keypad.delete,
  };
  return (
    <View style={[styles.grid, { rowGap }]}>
      {KEYS.map((key) => (
        <PressScale
          key={key}
          scale="control"
          onPress={() => {
            keypadTap();
            onKey(key);
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabels[key] ?? key}
          style={({ pressed }) => [
            styles.key,
            (key === '00' || key === '0') && styles.wideKey,
            { height: keyHeight, backgroundColor: pressed ? colors.card3 : colors.card2 },
          ]}
        >
          {key === 'del' ? (
            <Feather name="delete" size={iconSize} color={colors.muted} />
          ) : (
            <Txt variant="summaryNet" style={{ fontSize: digitSize }}>
              {DISPLAY[key] ?? key}
            </Txt>
          )}
        </PressScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    // rowGap is supplied per-render so it can compact with the keys.
  },
  key: {
    // Four columns keep the calculator short enough for compact phone sheets.
    width: '23%',
    borderRadius: metrics.keypadKeyRadius,
    alignItems: 'center',
    justifyContent: 'center',
    // height is supplied per-render (see MIN_KEY_HEIGHT).
  },
  wideKey: { width: '48.5%' },
});
