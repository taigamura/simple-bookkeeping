import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { KajiNearbyModuleEvents } from './KajiNearby.types';

declare class KajiNearbyModule extends NativeModule<KajiNearbyModuleEvents> {
  startAsync(serviceType: string, deviceId: string, protocolVersion: number, householdTag: string): Promise<void>;
  stopAsync(): Promise<void>;
  sendAsync(peerDeviceId: string, envelope: string): Promise<void>;
}

// Optional at module load so web, Jest, and Expo Go can render the app. The
// concrete transport reports an explicit unavailable error if it is started
// without the development-build native module.
export default requireOptionalNativeModule<KajiNearbyModule>('KajiNearby');
