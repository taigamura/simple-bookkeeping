/**
 * CalendarScreen — placeholder for the home tab. The real month grid, In/Out/Net
 * strip and day list arrive in slices #3/#4; for now it just proves the shell
 * routes here and the theme applies.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt, metrics } from '../theme';

export function CalendarScreen() {
  return (
    <View style={styles.screen}>
      <Txt variant="screenTitle">Calendar</Txt>
      <Txt variant="secondary" tone="muted" style={styles.hint}>
        Month grid & day list land in the next slices.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: metrics.screenPadX, paddingTop: 12 },
  hint: { marginTop: 8 },
});
