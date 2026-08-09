import { AppState, type AppStateStatus } from 'react-native';
import KajiNearbyModule from '../modules/kaji-nearby/src/KajiNearbyModule';
import type { NativeMessageEvent, NativePeerEvent } from '../modules/kaji-nearby/src/KajiNearby.types';
import type { AuthenticatedEnvelope } from '../domain/pairing';
import {
  type NearbyPeer,
  type NearbySyncCoordinator,
  type NearbyTransport,
  NEARBY_PROTOCOL_VERSION,
} from './nearbySync';

function peerFromEvent(event: NativePeerEvent): NearbyPeer {
  return {
    deviceId: event.deviceId,
    discoveryInfo: {
      protocolVersion: event.protocolVersion as typeof NEARBY_PROTOCOL_VERSION,
      householdTag: event.householdTag,
    },
  };
}

function parseEnvelope(value: string): AuthenticatedEnvelope {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  if (parsed.v !== 1 || parsed.algorithm !== 'AES-GCM-256' || typeof parsed.householdId !== 'string'
    || typeof parsed.senderDeviceId !== 'string' || typeof parsed.messageId !== 'string'
    || typeof parsed.sealed !== 'string') throw new Error('Invalid native nearby envelope');
  return parsed as unknown as AuthenticatedEnvelope;
}

/** Concrete adapter for the autolinked Swift MultipeerConnectivity module. */
export function createNativeNearbyTransport(): NearbyTransport {
  let subscriptions: Array<{ remove(): void }> = [];
  return {
    async start({ serviceType, deviceId, discoveryInfo, handlers }) {
      subscriptions.forEach((subscription) => subscription.remove());
      subscriptions = [
        KajiNearbyModule.addListener('onPeer', (event) => handlers.onPeer(peerFromEvent(event))),
        KajiNearbyModule.addListener('onMessage', (event: NativeMessageEvent) => {
          try {
            handlers.onMessage(peerFromEvent(event), parseEnvelope(event.envelope));
          } catch (error) {
            handlers.onError(error instanceof Error ? error : new Error(String(error)));
          }
        }),
        KajiNearbyModule.addListener('onError', (event) => handlers.onError(new Error(event.message))),
      ];
      try {
        await KajiNearbyModule.startAsync(
          serviceType,
          deviceId,
          discoveryInfo.protocolVersion,
          discoveryInfo.householdTag,
        );
      } catch (error) {
        subscriptions.forEach((subscription) => subscription.remove());
        subscriptions = [];
        throw error;
      }
    },
    async stop() {
      subscriptions.forEach((subscription) => subscription.remove());
      subscriptions = [];
      await KajiNearbyModule.stopAsync();
    },
    send(peer, envelope) {
      return KajiNearbyModule.sendAsync(peer.deviceId, JSON.stringify(envelope));
    },
  };
}

/** Starts only while the app is active and returns an explicit teardown hook. */
export function bindNearbySyncToForeground(coordinator: NearbySyncCoordinator): () => void {
  const update = (status: AppStateStatus) => {
    void coordinator.setForeground(status === 'active');
  };
  update(AppState.currentState);
  const subscription = AppState.addEventListener('change', update);
  return () => {
    subscription.remove();
    void coordinator.setForeground(false);
  };
}
