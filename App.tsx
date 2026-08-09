import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Root } from './nav';
import { useStore } from './store';
import { MotionProvider, ThemeProvider, useTheme } from './theme';
import { useAppFonts } from './theme/useAppFonts';
import { SummaryGrowthPrototype } from './screens/SummaryGrowthPrototype';
import { LoadingScreen } from './ui/LoadingScreen';
import { quickEntryBridge } from './platform/quickEntryBridge';
import { parseQuickEntryUrl } from './platform/quickEntryLinks';
import type { EntryDraft } from './domain';

// Keep the native splash screen (asset + dark background configured via the
// expo-splash-screen plugin in app.json, #25) from auto-hiding before React is
// mounted. It hands off to LoadingScreen once the component tree is ready.
// Called at module scope, not inside the component, per the package's own
// guidance. A no-op on web (no native splash there).
SplashScreen.preventAutoHideAsync();

/**
 * Root. Holds render until both gates clear — mono fonts loaded (decision 5)
 * and persisted state restored — then mounts the ThemeProvider seeded from the
 * stored theme, writing back every change so the choice survives reload. Inside
 * sits the bespoke nav shell (tabs + sheets); real screens fill in from slice #2.
 */
export default function App() {
  const fontsLoaded = useAppFonts();
  const [openingComplete, setOpeningComplete] = useState(false);
  const [quickEntryDraft, setQuickEntryDraft] = useState<EntryDraft | null>(null);
  const [quickEntryPresentationToken, setQuickEntryPresentationToken] = useState(0);
  const {
    ready,
    state,
    update,
    showCorruptNotice,
    hasCorruptStash,
    readCorruptStash,
    persistenceNotice,
    retryQuickEntrySnapshot,
    reconcileQuickEntries,
  } = useStore();
  const appReady = fontsLoaded && ready;

  useEffect(() => {
    // Keep the native splash as the readiness cover. Providers must not mount
    // against DEFAULT_STATE: their initial preferences are captured once, so
    // wait for the hydrated theme/motion values before the React handoff.
    if (appReady) SplashScreen.hideAsync();
  }, [appReady]);

  const pendingDraft = useRef<{ draft: EntryDraft; token: number; resolve: () => void } | null>(null);
  const presentationToken = useRef(0);
  const readyRef = useRef(ready);
  const reconcileRef = useRef(reconcileQuickEntries);
  const handoffRef = useRef<((draft: EntryDraft) => Promise<void>) | undefined>(undefined);
  readyRef.current = ready;
  reconcileRef.current = reconcileQuickEntries;
  const handoffDraft = useCallback((draft: EntryDraft) => new Promise<void>((resolve) => {
    const token = ++presentationToken.current;
    pendingDraft.current = { draft, token, resolve };
    setQuickEntryDraft(draft);
    setQuickEntryPresentationToken(token);
  }), []);
  handoffRef.current = handoffDraft;
  const reconcileRunning = useRef(false);
  const reconcileAgain = useRef(false);
  const requestReconcile = useCallback(() => {
    if (!readyRef.current) return;
    if (reconcileRunning.current) {
      reconcileAgain.current = true;
      return;
    }
    reconcileRunning.current = true;
    void (async () => {
      do {
        reconcileAgain.current = false;
        await reconcileRef.current(handoffRef.current);
      } while (reconcileAgain.current);
    })().catch(() => {}).finally(() => {
      reconcileRunning.current = false;
    });
  }, []);
  const disposeDraft = useCallback((draft: EntryDraft, token: number) => {
    if (pendingDraft.current?.draft !== draft || pendingDraft.current.token !== token) return;
    pendingDraft.current.resolve();
    pendingDraft.current = null;
    setQuickEntryDraft((current) => current === draft ? null : current);
    requestReconcile();
  }, [requestReconcile]);

  const receiveUrl = useCallback(async (url: string | null) => {
    if (!url) return;
    if (quickEntryBridge) {
      await quickEntryBridge.enqueueDeepLinkAsync(url);
      requestReconcile();
      return;
    }
    if (readyRef.current) {
      const draft = parseQuickEntryUrl(url);
      const handoff = handoffRef.current;
      if (draft && handoff) await handoff(draft);
    }
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => { void receiveUrl(url).catch(() => {}); });
    void Promise.resolve(Linking.getInitialURL()).then(receiveUrl).catch(() => {});
    return () => subscription?.remove?.();
  }, [receiveUrl]);

  useEffect(() => {
    if (!appReady) return;
    requestReconcile();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      if (persistenceNotice === 'quick-entry-cache-failed') void retryQuickEntrySnapshot().catch(() => {});
      requestReconcile();
    });
    return () => subscription.remove();
  }, [appReady, persistenceNotice, retryQuickEntrySnapshot]);

  const finishOpening = useCallback(() => setOpeningComplete(true), []);

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

  // The native splash remains visible over this null tree. Mounting providers
  // only after hydration ensures persisted dark/reduced preferences seed their
  // useState values on the very first render.
  if (!appReady) return null;

  return (
    // GestureHandlerRootView (#39) must wrap the whole app so gesture-handler —
    // and the @gorhom/bottom-sheet drags it powers — receive touches. flex:1 so
    // it fills, letting the web phone-frame still size the app below it.
    <GestureHandlerRootView style={styles.root}>
      <MotionProvider
        initialPreference={state.motion}
        onPreferenceChange={(motion) => update({ motion })}
      >
        {/* ThemeProvider sits inside MotionProvider so appearance changes can
            honor Kaji's own full/system/reduced preference. */}
        <ThemeProvider
          initialPreference={state.theme}
          onPreferenceChange={(theme) => update({ theme })}
        >
          <ThemedStatusBar />
          {/* Calendar is the first meaningful React paint, mounted behind the
              opaque opening layer so the layer can reveal real content. */}
          <Root
            state={state}
            update={update}
            showCorruptNotice={showCorruptNotice}
            hasCorruptStash={hasCorruptStash}
            readCorruptStash={readCorruptStash}
            persistenceNotice={persistenceNotice}
            quickEntryDraft={quickEntryDraft}
            quickEntryPresentationToken={quickEntryPresentationToken}
            onQuickEntryDraftDisposition={disposeDraft}
          />
          {!openingComplete ? (
            <LoadingScreen ready onFinished={finishOpening} />
          ) : null}
        </ThemeProvider>
      </MotionProvider>
    </GestureHandlerRootView>
  );
}

/** Commits with ThemeProvider's rendered palette at the fade-through midpoint. */
function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
