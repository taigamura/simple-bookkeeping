/**
 * SummaryScreen — placeholder for the summary tab. The net card, in/out split
 * bar and ranked category bars arrive in slice #5; for now it proves the shell
 * routes here, applies the theme, and keeps Settings reachable via its header ⚙.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt, metrics } from '../theme';
import { IconButton } from '../nav/IconButton';

export function SummaryScreen({ onSettings }: { onSettings: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Txt variant="screenTitle">Summary</Txt>
        <IconButton name="settings" accessibilityLabel="Settings" onPress={onSettings} />
      </View>
      <Txt variant="secondary" tone="muted" style={styles.hint}>
        Net card & category breakdown land in slice #5.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: metrics.screenPadX, paddingTop: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  hint: { marginTop: 8 },
});
