/**
 * AppShell — the outer frame (decision 10). On web, center the app in a
 * `maxWidth: 402` full-height rounded card with a subtle shadow on a neutral
 * backdrop, so it reads as a phone. On native, fill the screen with a
 * `SafeAreaView` that insets top/left/right only — the bottom edge is left to
 * the TabBar (#41). No faux status bar / dynamic island / home indicator anywhere.
 *
 * Sheets (@gorhom/bottom-sheet) portal to the nearest `BottomSheetModalProvider`,
 * so the provider is mounted *inside* the phone frame here (#39): on web the
 * card's `overflow: hidden` then keeps the slide-up sheet and its backdrop
 * clipped inside the 402px column, exactly as the old RN Modal was.
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
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
          <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
        </View>
      </View>
    );
  }

  return (
    // Bottom edge is deliberately NOT inset here (#41): the TabBar paints its own
    // card background flush to the physical screen bottom and pads itself by the
    // bottom inset, so the app reaches the device edge with no detached strip.
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.native, { backgroundColor: colors.bg }]}
    >
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
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
