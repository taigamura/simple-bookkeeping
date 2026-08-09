import { NativeModule, requireNativeModule } from 'expo';
import type { KajiNearbyModuleEvents } from './KajiNearby.types';

declare class KajiNearbyModule extends NativeModule<KajiNearbyModuleEvents> {
  startAsync(serviceType: string, deviceId: string, protocolVersion: number, householdTag: string): Promise<void>;
  stopAsync(): Promise<void>;
  sendAsync(peerDeviceId: string, envelope: string): Promise<void>;
}

export default requireNativeModule<KajiNearbyModule>('KajiNearby');
