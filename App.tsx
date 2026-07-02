import { StatusBar } from 'expo-status-bar';

import { useStore } from './store';
import { ThemeProvider, useAppFonts } from './theme';
import { ThemePreview } from './theme/ThemePreview';

/**
 * Root. Holds render until both gates clear — mono fonts loaded (decision 5)
 * and persisted state restored — then mounts the ThemeProvider seeded from the
 * stored theme, writing back every change so the choice survives reload.
 * Screens land in Stage 5; for now a small preview validates the design system.
 */
export default function App() {
  const fontsLoaded = useAppFonts();
  const { ready, state, update } = useStore();
  if (!fontsLoaded || !ready) return null;

  return (
    <ThemeProvider
      initialMode={state.theme}
      onModeChange={(mode) => update({ theme: mode })}
    >
      <StatusBar style="auto" />
      <ThemePreview />
    </ThemeProvider>
  );
}
