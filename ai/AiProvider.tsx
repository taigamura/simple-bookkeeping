/**
 * Injects the one `SuitoAi` implementation (native, fake, or unavailable) at
 * the app root, the same way `Store` is threaded from `App`. Screens read it
 * with `useAi()`.
 *
 * Availability is asked once on mount and again whenever the app returns to
 * the foreground, so turning Apple Intelligence on later makes the AI surfaces
 * appear without a relaunch (PRD story 62). Until the first answer arrives it
 * reads as unavailable: AI surfaces appear, they never flash and vanish.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { UNAVAILABLE_AI, type Availability, type SuitoAi } from './contract';

export const OFF: Availability = { onDevice: 'unsupported', system: 'unsupported' };

export interface AiContextValue {
  ai: SuitoAi;
  availability: Availability;
}

const AiContext = createContext<AiContextValue>({ ai: UNAVAILABLE_AI, availability: OFF });

export function AiProvider({ ai, children }: { ai: SuitoAi; children: React.ReactNode }) {
  const [availability, setAvailability] = useState<Availability>(OFF);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      ai.availability().then(
        (next) => {
          if (!alive) return;
          setAvailability((current) =>
            current.onDevice === next.onDevice && current.system === next.system ? current : next,
          );
        },
        () => {
          if (alive) setAvailability(OFF);
        },
      );
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, [ai]);

  const value = useMemo(() => ({ ai, availability }), [ai, availability]);
  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiContextValue {
  return useContext(AiContext);
}

/** True when the in-app (on-device model) surfaces should render. */
export function useOnDeviceAi(): boolean {
  return useAi().availability.onDevice === 'available';
}
