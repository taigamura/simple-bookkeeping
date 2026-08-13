import { NativeModule, registerWebModule } from 'expo';
import type { KajiNearbyModuleEvents } from './KajiNearby.types';

class KajiNearbyModule extends NativeModule<KajiNearbyModuleEvents> {
  async startAsync(): Promise<void> { throw new Error('Nearby sync is available on iOS only'); }
  async stopAsync(): Promise<void> {}
  async sendAsync(): Promise<void> { throw new Error('Nearby sync is available on iOS only'); }
}

export default registerWebModule(KajiNearbyModule, 'KajiNearby');
