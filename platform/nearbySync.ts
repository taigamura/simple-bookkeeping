import type { AuthenticatedEnvelope, HouseholdPairingState } from '../domain/pairing';
import {
  createAuthenticatedEnvelope,
  openAuthenticatedEnvelope,
} from '../domain/pairing';

export const NEARBY_PROTOCOL_VERSION = 1 as const;
export const NEARBY_SERVICE_TYPE = 'kaji-sync';

export interface NearbyPeer {
  deviceId: string;
  /** Discovery metadata is deliberately limited to protocol and household identity. */
  discoveryInfo: {
    protocolVersion: typeof NEARBY_PROTOCOL_VERSION;
    householdId: string;
  };
}

export interface NearbyTransportHandlers {
  onPeer: (peer: NearbyPeer) => void;
  onMessage: (peer: NearbyPeer, envelope: AuthenticatedEnvelope) => void;
  onError: (error: Error) => void;
}

/** The only native capability the coordinator needs from MultipeerConnectivity. */
export interface NearbyTransport {
  start(options: {
    serviceType: string;
    discoveryInfo: NearbyPeer['discoveryInfo'];
    handlers: NearbyTransportHandlers;
  }): Promise<void>;
  stop(): Promise<void>;
  send(peer: NearbyPeer, envelope: AuthenticatedEnvelope): Promise<void>;
}

/**
 * Adapter seam for an Expo native module backed by MCSession/MCNearbyService.
 * The native module is injected so web builds and unit tests never import a
 * native-only implementation. The module must not advertise financial data.
 */
export interface MultipeerConnectivityModule {
  start(options: {
    serviceType: string;
    discoveryInfo: NearbyPeer['discoveryInfo'];
    onPeer: (peer: NearbyPeer) => void;
    onMessage: (peer: NearbyPeer, envelope: AuthenticatedEnvelope) => void;
    onError: (error: Error) => void;
  }): Promise<void>;
  stop(): Promise<void>;
  send(peer: NearbyPeer, envelope: AuthenticatedEnvelope): Promise<void>;
}

export function createMultipeerConnectivityTransport(module: MultipeerConnectivityModule): NearbyTransport {
  return {
    start: ({ serviceType, discoveryInfo, handlers }) => module.start({
      serviceType,
      discoveryInfo,
      onPeer: handlers.onPeer,
      onMessage: handlers.onMessage,
      onError: handlers.onError,
    }),
    stop: () => module.stop(),
    send: (peer, envelope) => module.send(peer, envelope),
  };
}

export interface NearbyOperationBatch {
  v: typeof NEARBY_PROTOCOL_VERSION;
  kind: 'operations';
  operations: unknown[];
}

export interface NearbyOperationAck {
  v: typeof NEARBY_PROTOCOL_VERSION;
  kind: 'ack';
  operationIds: string[];
}

type NearbyPayload = NearbyOperationBatch | NearbyOperationAck;

export interface NearbySyncCoordinatorOptions {
  state: HouseholdPairingState;
  householdKey: string;
  deviceId: string;
  transport: NearbyTransport;
  /** Returns true only after the deterministic domain reducer accepted the operation. */
  applyOperation: (operation: unknown) => boolean;
  onError?: (error: Error) => void;
}

/**
 * Foreground-only nearby sync coordinator. Nothing starts until foreground is
 * true, and failed sends remain queued for the next peer/foreground event.
 */
export class NearbySyncCoordinator {
  private readonly options: NearbySyncCoordinatorOptions;
  private readonly seenMessageIds = new Set<string>();
  private pending: unknown[] = [];
  private peer: NearbyPeer | null = null;
  private foreground = false;
  private started = false;

  constructor(options: NearbySyncCoordinatorOptions) {
    this.options = options;
  }

  get queuedOperationIds(): string[] {
    return this.pending.map((operation) => operationId(operation)).filter((id): id is string => id !== null);
  }

  get isForeground(): boolean { return this.foreground; }

  async setForeground(foreground: boolean): Promise<void> {
    if (this.foreground === foreground) return;
    this.foreground = foreground;
    if (!foreground) {
      this.peer = null;
      if (this.started) {
        this.started = false;
        await this.options.transport.stop();
      }
      return;
    }
    if (!this.started) {
      this.started = true;
      try {
        await this.options.transport.start({
          serviceType: NEARBY_SERVICE_TYPE,
          discoveryInfo: {
            protocolVersion: NEARBY_PROTOCOL_VERSION,
            householdId: this.options.state.householdId,
          },
          handlers: {
            onPeer: (peer) => void this.handlePeer(peer),
            onMessage: (peer, envelope) => void this.handleMessage(peer, envelope),
            onError: (error) => this.report(error),
          },
        });
      } catch (error) {
        this.started = false;
        this.report(asError(error));
      }
    }
  }

  enqueue(operation: unknown): void {
    const id = operationId(operation);
    if (id === null || this.pending.some((queued) => operationId(queued) === id)) return;
    this.pending = [...this.pending, operation];
    void this.flush();
  }

  private handlePeer(peer: NearbyPeer): void {
    if (!this.foreground || !this.started || !this.isAuthorizedPeer(peer)) return;
    this.peer = peer;
    void this.flush();
  }

  private async handleMessage(peer: NearbyPeer, envelope: AuthenticatedEnvelope): Promise<void> {
    if (!this.foreground || !this.isAuthorizedPeer(peer)) return;
    try {
      const payload = await openAuthenticatedEnvelope<NearbyPayload>(
        envelope,
        this.options.householdKey,
        this.options.state,
        { seenMessageIds: this.seenMessageIds, validate: isNearbyPayload },
      );
      if (payload.kind === 'operations') {
        const ids = payload.operations.map(operationId).filter((id): id is string => id !== null);
        payload.operations.forEach((operation) => { this.options.applyOperation(operation); });
        await this.send(peer, { v: NEARBY_PROTOCOL_VERSION, kind: 'ack', operationIds: ids });
      } else {
        this.pending = this.pending.filter((operation) => {
          const id = operationId(operation);
          return id === null || !payload.operationIds.includes(id);
        });
      }
      void this.flush();
    } catch (error) {
      this.report(asError(error));
    }
  }

  private async flush(): Promise<void> {
    if (!this.foreground || !this.peer || this.pending.length === 0) return;
    const batch: NearbyOperationBatch = {
      v: NEARBY_PROTOCOL_VERSION,
      kind: 'operations',
      operations: this.pending,
    };
    try {
      await this.send(this.peer, batch);
    } catch (error) {
      this.report(asError(error));
    }
  }

  private async send(peer: NearbyPeer, payload: NearbyPayload): Promise<void> {
    const envelope = await createAuthenticatedEnvelope(
      payload,
      this.options.householdKey,
      this.options.state,
      this.options.deviceId,
    );
    await this.options.transport.send(peer, envelope);
  }

  private isAuthorizedPeer(peer: NearbyPeer): boolean {
    return peer.deviceId !== this.options.deviceId
      && peer.discoveryInfo.protocolVersion === NEARBY_PROTOCOL_VERSION
      && peer.discoveryInfo.householdId === this.options.state.householdId
      && this.options.state.devices.some((device) => device.deviceId === peer.deviceId && device.revokedAt === undefined);
  }

  private report(error: Error): void {
    this.options.onError?.(error);
  }
}

function operationId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || typeof (value as { operationId?: unknown }).operationId !== 'string') return null;
  return (value as { operationId: string }).operationId;
}

function isNearbyPayload(value: unknown): value is NearbyPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  if (payload.v !== NEARBY_PROTOCOL_VERSION || (payload.kind !== 'operations' && payload.kind !== 'ack')) return false;
  if (payload.kind === 'operations') {
    return Array.isArray(payload.operations) && payload.operations.every((operation: unknown) => operationId(operation) !== null);
  }
  return Array.isArray(payload.operationIds) && payload.operationIds.every((id: unknown) => typeof id === 'string');
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function nearbyDiscoveryInfo(householdId: string): NearbyPeer['discoveryInfo'] {
  return { protocolVersion: NEARBY_PROTOCOL_VERSION, householdId };
}
