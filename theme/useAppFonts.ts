/**
 * useAppFonts — loads the JetBrains Mono weights used across Kaji (the mono
 * "signature": every number + uppercase micro-label). System sans needs no
 * loading. Returns whether fonts are ready; the root holds render until then
 * (decision 5).
 */
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  useFonts,
} from '@expo-google-fonts/jetbrains-mono';

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  return loaded;
}
