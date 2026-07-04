import { StatusBar } from 'expo-status-bar';

import { Root } from './nav';
import { useStore } from './store';
import { ThemeProvider } from './theme';
import { useAppFonts } from './theme/useAppFonts';

/**
 * Root. Holds render until both gates clear — mono fonts loaded (decision 5)
 * and persisted state restored — then mounts the ThemeProvider seeded from the
 * stored theme, writing back every change so the choice survives reload. Inside
 * sits the bespoke nav shell (tabs + sheets); real screens fill in from slice #2.
 */
export default function App() {
  const fontsLoaded = useAppFonts();
  const { ready, state, update, showCorruptNotice, hasCorruptStash, readCorruptStash } =
    useStore();
  if (!fontsLoaded || !ready) return null;

  return (
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
      />
    </ThemeProvider>
  );
}
