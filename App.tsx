import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Root } from './nav';
import { useStore } from './store';
import { ThemeProvider } from './theme';
import { useAppFonts } from './theme/useAppFonts';
import { SummaryGrowthPrototype } from './screens/SummaryGrowthPrototype';

// Keep the native splash screen (asset + dark background configured via the
// expo-splash-screen plugin in app.json, #25) up past its own auto-hide, so it
// still covers the fonts/persisted-state gate below. Called at module scope,
// not inside the component, per the package's own guidance — inside a
// component risks running after the splash has already auto-hidden. A no-op
// on web (no native splash there).
SplashScreen.preventAutoHideAsync();

/**
 * Root. Holds render until both gates clear — mono fonts loaded (decision 5)
 * and persisted state restored — then mounts the ThemeProvider seeded from the
 * stored theme, writing back every change so the choice survives reload. Inside
 * sits the bespoke nav shell (tabs + sheets); real screens fill in from slice #2.
 */
export default function App() {
  const fontsLoaded = useAppFonts();
  const {
    ready,
    state,
    update,
    showCorruptNotice,
    hasCorruptStash,
    readCorruptStash,
    persistenceNotice,
  } = useStore();
  const appReady = fontsLoaded && ready;

  useEffect(() => {
    if (appReady) SplashScreen.hideAsync();
  }, [appReady]);

  if (!appReady) return null;

  // THROWAWAY UI PROTOTYPE. Development web only; production always mounts
  // the real app. Open with `?prototype=growth&variant=A`.
  const growthPrototype =
    process.env.NODE_ENV !== 'production' &&
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('prototype') === 'growth';

  if (growthPrototype) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SummaryGrowthPrototype />
      </GestureHandlerRootView>
    );
  }

  return (
    // GestureHandlerRootView (#39) must wrap the whole app so gesture-handler —
    // and the @gorhom/bottom-sheet drags it powers — receive touches. flex:1 so
    // it fills, letting the web phone-frame still size the app below it.
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider
        initialMode={state.theme}
        onModeChange={(mode) => update({ theme: mode })}
      >
        <StatusBar style="auto" />
        <Root
          state={state}
          update={update}
          showCorruptNotice={showCorruptNotice}
          hasCorruptStash={hasCorruptStash}
          readCorruptStash={readCorruptStash}
          persistenceNotice={persistenceNotice}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
