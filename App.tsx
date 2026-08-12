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
import { householdKeychain } from './platform/householdKeychain';
import { HouseholdRuntime } from './platform/householdRuntime';
import { deviceAuthenticator } from './platform/deviceAuthentication';
import { householdSyncStatus, type EntryDraft } from './domain';

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
  const [householdRuntimeVersion, setHouseholdRuntimeVersion] = useState(0);
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
  const householdRuntime = useRef<HouseholdRuntime | null>(null);
  const updateRef = useRef(update);
  updateRef.current = update;

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
    reconcileAgain.current = true;
    if (reconcileRunning.current) {
      return;
    }
    reconcileRunning.current = true;
    void (async () => {
      try {
        while (reconcileAgain.current) {
          reconcileAgain.current = false;
          try {
            await reconcileRef.current(handoffRef.current);
          } catch {
            // A pending request is still allowed one drain turn after a failure.
          }
        }
      } finally {
        reconcileRunning.current = false;
        if (reconcileAgain.current) requestReconcile();
      }
    })();
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

  // The pairing checkpoint contains only IDs, membership, and sync history.
  // The household encryption key is read/written exclusively by Keychain.
  useEffect(() => {
    // Nearby household transport is currently an iOS native module. Keep web,
    // Android, Expo Go, and tests on the explicit unpaired presentation.
    if (!appReady || Platform.OS !== 'ios') return;
    const runtime = new HouseholdRuntime({
      keychain: householdKeychain,
      applyIncomingEntries: async (entries) => updateRef.current({ entries }),
      onChange: () => setHouseholdRuntimeVersion((version) => version + 1),
    });
    householdRuntime.current = runtime;
    void runtime.start(state.entries).catch(() => setHouseholdRuntimeVersion((version) => version + 1));
    return () => {
      if (householdRuntime.current === runtime) householdRuntime.current = null;
      runtime.dispose();
    };
    // The runtime captures the hydrated ledger exactly once. Subsequent ledger
    // changes flow through the observation effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady]);

  useEffect(() => {
    const runtime = householdRuntime.current;
    if (!runtime?.ready) return;
    void runtime.observeEntries(state.entries).catch(() => setHouseholdRuntimeVersion((version) => version + 1));
  }, [state.entries, householdRuntimeVersion]);

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
            householdSync={householdRuntime.current?.ready ? {
              model: householdRuntime.current.model,
              history: householdRuntime.current.history,
              onSyncNow: () => { void householdRuntime.current?.syncNow(); },
              onRestore: (transactionId, operationId) => { void householdRuntime.current?.restore(transactionId, operationId); },
              pairing: householdRuntime.current.pairingState && householdRuntime.current.deviceId ? {
                state: householdRuntime.current.pairingState,
                deviceId: householdRuntime.current.deviceId,
                onRevokeDevice: (deviceId) => { void householdRuntime.current?.revoke(deviceId); },
                onExportRecovery: (passphrase) => householdRuntime.current!.exportRecovery(state, passphrase, deviceAuthenticator),
                onRestoreRecovery: (pack, passphrase) => householdRuntime.current!.restoreRecovery(
                  state, pack, passphrase, deviceAuthenticator, (next) => updateRef.current(next),
                ),
              } : undefined,
            } : {
              model: householdSyncStatus({ paired: false, foreground: true, partnerPresent: false, queuedOperationCount: 0 }),
              history: [], onSyncNow: () => {}, onRestore: () => {},
            }}
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
