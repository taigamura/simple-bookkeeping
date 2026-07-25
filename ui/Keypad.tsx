/**
 * Keypad — a compact 4-column entry calculator with digits, `00`, arithmetic operators,
 * clear, equals, and ⌫. It is presentational: each press reports a `KeypadKey`
 * and the parent applies `pressKey` from the domain.
 */
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { KeypadKey } from '../domain';
import { strings } from '../i18n';
import { keypadTap } from '../platform/haptics';
import { useTheme, metrics, Txt } from '../theme';

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

export function Keypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  const { colors } = useTheme();
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
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => {
            keypadTap();
            onKey(key);
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabels[key] ?? key}
          style={({ pressed }) => [
            styles.key,
            (key === '00' || key === '0') && styles.wideKey,
            { backgroundColor: pressed ? colors.card3 : colors.card2 },
          ]}
        >
          {key === 'del' ? (
            <Feather name="delete" size={20} color={colors.muted} />
          ) : (
            <Txt variant="summaryNet" style={styles.digit}>
              {DISPLAY[key] ?? key}
            </Txt>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: metrics.keypadGap,
  },
  key: {
    // Four columns keep the calculator short enough for compact phone sheets.
    width: '23%',
    height: metrics.keypadKeySize,
    borderRadius: metrics.keypadKeyRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideKey: { width: '48.5%' },
  digit: { fontSize: 22 },
});
