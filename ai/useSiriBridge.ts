/**
 * Siri bridge: writes the Siri snapshot after saves, merges the Siri inbox on
 * foreground, and keeps Spotlight in sync.
 *
 * PLACEHOLDER no-op on the UI branch. The domain slice owns the real version;
 * on merge, take theirs. Signature is the contract `App.tsx` codes against.
 */
import type { AppState as SuitoState } from '../store/schema';
import type { Locale, SuitoAi, YMD } from './contract';

export interface SiriBridgeInput {
  ai: SuitoAi;
  state: SuitoState;
  ready: boolean;
  update: (patch: Partial<SuitoState>) => void;
  locale: Locale;
  today: YMD;
}

export function useSiriBridge(_input: SiriBridgeInput): void {}
