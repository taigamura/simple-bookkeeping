import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useAppFonts } from './theme';
import { ThemePreview } from './theme/ThemePreview';

/**
 * Root. Loads the mono fonts before rendering (decision 5 — hold until ready),
 * then mounts the ThemeProvider. Screens land in Stage 5; for now a small
 * design-system preview validates tokens/fonts/theming on web.
 */
export default function App() {
  const fontsLoaded = useAppFonts();
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <ThemePreview />
    </ThemeProvider>
  );
}
