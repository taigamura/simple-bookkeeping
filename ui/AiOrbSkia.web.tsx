/**
 * Web never renders the Skia orb (it would need CanvasKit); `AiOrb` uses its
 * static stand-in there. This stub only keeps `@shopify/react-native-skia` out
 * of the web bundle.
 */
import type React from 'react';

import type { AiOrbProps } from './AiOrb';

export const AiOrbSkia: React.ComponentType<AiOrbProps> = () => null;
