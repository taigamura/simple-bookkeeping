/**
 * AppShell — the outer frame (decision 10). On web, center the app in a
 * `maxWidth: 402` full-height rounded card with a subtle shadow on a neutral
 * backdrop, so it reads as a phone. On native, fill the screen with a
 * `SafeAreaView`. No faux status bar / dynamic island / home indicator anywhere.
 *
 * Sheets (RN Modal) render at the window root, so on web they must be clipped
 * to the phone column: `overflow: hidden` on the card keeps the slide-up sheet
 * and its backdrop inside the 402px frame.
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, metrics, shadows } from '../theme';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <Frame>{children}</Frame>
    </SafeAreaProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webBackdrop, { backgroundColor: colors.card3 }]}>
        <View
          style={[
            styles.webPhone,
            { backgroundColor: colors.bg, borderColor: colors.border },
            shadows.card,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.native, { backgroundColor: colors.bg }]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  webPhone: {
    flex: 1,
    width: '100%',
    maxWidth: metrics.webMaxWidth,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
  },
  native: { flex: 1 },
});
