/**
 * SummaryScreen — placeholder for the summary tab. The net card, in/out split
 * bar and ranked category bars arrive in slice #5; for now it just proves the
 * shell routes here and the theme applies.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt, metrics } from '../theme';

export function SummaryScreen() {
  return (
    <View style={styles.screen}>
      <Txt variant="screenTitle">Summary</Txt>
      <Txt variant="secondary" tone="muted" style={styles.hint}>
        Net card & category breakdown land in slice #5.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: metrics.screenPadX, paddingTop: 12 },
  hint: { marginTop: 8 },
});
