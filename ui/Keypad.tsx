/**
 * Keypad — the 3-column integer pad (decision 11): 1–9, then `000`, `0`, and ⌫
 * (Feather delete icon, decision 6). It is presentational: each press reports a
 * `KeypadKey` and the parent applies `pressKey` from the domain to its amount
 * string. Digits are mono; the pad never holds state itself.
 */
import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { KeypadKey } from '../domain';
import { strings } from '../i18n';
import { useTheme, metrics, Txt } from '../theme';

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];

export function Keypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => onKey(key)}
          accessibilityRole="button"
          accessibilityLabel={key === 'del' ? strings.keypad.delete : key}
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: pressed ? colors.card3 : colors.card2 },
          ]}
        >
          {key === 'del' ? (
            <Feather name="delete" size={20} color={colors.muted} />
          ) : (
            <Txt variant="summaryNet" style={styles.digit}>
              {key}
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
    // Three columns with a gap; percentage keeps it fluid inside the sheet.
    width: '31.5%',
    height: metrics.keypadKeySize,
    borderRadius: metrics.keypadKeyRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 22 },
});
