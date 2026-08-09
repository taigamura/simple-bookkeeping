import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import type { AuthenticatedEnvelope, HouseholdPairingState } from '../domain/pairing';
import {
  createAuthenticatedEnvelope,
  openAuthenticatedEnvelope,
  PairingError,
} from '../domain/pairing';

export const NEARBY_PROTOCOL_VERSION = 1 as const;
export const NEARBY_SERVICE_TYPE = 'kaji-sync';

export interface NearbyPeer {
  deviceId: string;
  discoveryInfo: {
    protocolVersion: typeof NEARBY_PROTOCOL_VERSION;
    /** Key-derived rotating value, never a stable household identifier. */
    householdTag: string;
  };
}

export interface NearbyTransportHandlers {
  onPeer: (peer: NearbyPeer) => void;
  onMessage: (peer: NearbyPeer, envelope: AuthenticatedEnvelope) => void;
  onError: (error: Error) => void;
}

export interface NearbyTransport {
  start(options: {
    serviceType: string;
    deviceId: string;
    discoveryInfo: NearbyPeer['discoveryInfo'];
    handlers: NearbyTransportHandlers;
  }): Promise<void>;
  stop(): Promise<void>;
  send(peer: NearbyPeer, envelope: AuthenticatedEnvelope): Promise<void>;
}

/** Injectable seam retained for transport doubles and alternate native hosts. */
export interface MultipeerConnectivityModule {
  start(options: {
    serviceType: string;
    deviceId: string;
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
    start: ({ serviceType, deviceId, discoveryInfo, handlers }) => module.start({
      serviceType,
      deviceId,
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
  batchId: string;
  operations: unknown[];
}

export interface NearbyOperationAck {
  v: typeof NEARBY_PROTOCOL_VERSION;
  kind: 'ack';
  batchId: string;
  operationIds: string[];
}

type NearbyPayload = NearbyOperationBatch | NearbyOperationAck;
export type NearbyApplyResult = 'applied' | 'duplicate' | 'rejected';

export interface NearbyInFlightBatch {
  batchId: string;
  peerDeviceId: string;
  operationIds: string[];
}

export interface NearbyQueueSnapshot {
  pending: unknown[];
  seenMessageIds: string[];
  inFlight: NearbyInFlightBatch | null;
}

export interface NearbyQueueStore {
  load(): Promise<NearbyQueueSnapshot>;
  save(snapshot: NearbyQueueSnapshot): Promise<void>;
}

export interface NearbySyncCoordinatorOptions {
  state: HouseholdPairingState;
  householdKey: string;
  deviceId: string;
  transport: NearbyTransport;
  /** Resolve applied only after the state and replay fence are durably committed. */
  applyOperation: (operation: unknown) => NearbyApplyResult | Promise<NearbyApplyResult>;
  /** Preferred atomic seam for receiving a complete operation batch. */
  applyOperations?: (operations: readonly unknown[]) => boolean | Promise<boolean>;
  queueStore: NearbyQueueStore;
  onError?: (error: Error) => void;
  onSyncSuccess?: (timestamp: string) => void;
}

export interface NearbySyncContext {
  state: HouseholdPairingState;
  householdKey: string;
  deviceId: string;
}

export class NearbySyncCoordinator {
  private readonly options: NearbySyncCoordinatorOptions;
  private context: NearbySyncContext;
  private readonly seenMessageIds = new Set<string>();
  private pending: unknown[] = [];
  private inFlight: NearbyInFlightBatch | null = null;
  private peer: NearbyPeer | null = null;
  private foreground = false;
  private started = false;
  private discoveryTag = '';
  private loaded = false;
  private loading: Promise<void> | null = null;
  private flushing = false;
  private lifecycle: Promise<void> = Promise.resolve();
  private lastSyncedAt?: string;

  constructor(options: NearbySyncCoordinatorOptions) {
    this.options = options;
    this.context = { state: options.state, householdKey: options.householdKey, deviceId: options.deviceId };
  }

  get queuedOperationIds(): string[] {
    return this.pending.map(operationId).filter((id): id is string => id !== null);
  }

  get isForeground(): boolean { return this.foreground; }
  get lastSyncTimestamp(): string | undefined { return this.lastSyncedAt; }

  /** Rebind live membership and key material after revocation or rotation. */
  reconfigure(context: NearbySyncContext): Promise<void> {
    this.context = context;
    this.lifecycle = this.lifecycle.then(async () => {
      this.peer = null;
      this.discoveryTag = '';
      this.inFlight = null;
      if (this.started) {
        this.started = false;
        try { await this.options.transport.stop(); } catch (error) { this.report(asError(error)); }
      }
      if (!this.isLocalDeviceAuthorized()) {
        this.pending = [];
        await this.ensureLoaded();
        await this.persist();
      }
      if (this.foreground) await this.applyForeground(true);
    });
    return this.lifecycle;
  }

  /** Safe manual action. A missing peer is reported without changing ledger state. */
  syncNow(): Promise<'sent' | 'partner-absent' | 'not-authorized'> {
    this.lifecycle = this.lifecycle.then(async () => {
      if (!this.isLocalDeviceAuthorized()) return;
      await this.ensureLoaded();
      await this.flush();
    });
    return this.lifecycle.then(() => !this.isLocalDeviceAuthorized()
      ? 'not-authorized' : this.peer && this.started ? 'sent' : 'partner-absent');
  }

  setForeground(foreground: boolean): Promise<void> {
    this.foreground = foreground;
    this.lifecycle = this.lifecycle.then(() => this.applyForeground(foreground));
    return this.lifecycle;
  }

  enqueue(operation: unknown): void {
    // A revoked phone may still have a producer holding this coordinator. Do
    // not let that producer repopulate the durable queue after revocation.
    if (!this.isLocalDeviceAuthorized()) return;
    const id = operationId(operation);
    if (id === null || this.pending.some((queued) => operationId(queued) === id)) return;
    this.pending = [...this.pending, operation];
    void this.ensureLoaded()
      .then(() => this.persist())
      .then(() => this.flush())
      .catch((error) => this.report(asError(error)));
  }

  private async applyForeground(foreground: boolean): Promise<void> {
    if (foreground && !this.isLocalDeviceAuthorized()) {
      await this.ensureLoaded();
      this.pending = [];
      this.inFlight = null;
      await this.persist();
      this.peer = null;
      return;
    }
    if (!foreground) {
      this.peer = null;
      if (this.started) {
        this.started = false;
        try { await this.options.transport.stop(); } catch (error) { this.report(asError(error)); }
      }
      return;
    }
    await this.ensureLoaded();
    if (this.started) return;
    try {
      this.discoveryTag = await nearbyDiscoveryTag(this.context.householdKey);
      await this.options.transport.start({
        serviceType: NEARBY_SERVICE_TYPE,
        deviceId: this.context.deviceId,
        discoveryInfo: nearbyDiscoveryInfo(this.discoveryTag),
        handlers: {
          onPeer: (peer) => void this.handlePeer(peer),
          onMessage: (peer, envelope) => void this.handleMessage(peer, envelope),
          onError: (error) => this.report(error),
        },
      });
      this.started = true;
      if (!this.foreground) await this.applyForeground(false);
    } catch (error) {
      this.started = false;
      this.report(asError(error));
    }
  }

  private handlePeer(peer: NearbyPeer): void {
    if (!this.foreground || !this.started || !this.isAuthorizedPeer(peer)) return;
    this.peer = peer;
    void this.flush();
  }

  private async handleMessage(peer: NearbyPeer, envelope: AuthenticatedEnvelope): Promise<void> {
    if (!this.foreground || !this.started || !this.isLocalDeviceAuthorized() || !this.isAuthorizedPeer(peer)) return;
    try {
      if (envelope.senderDeviceId !== peer.deviceId) throw new PairingError('device-not-authorized');
      if (this.seenMessageIds.has(envelope.messageId)) throw new PairingError('replayed-message');
      const payload = await openAuthenticatedEnvelope<NearbyPayload>(
        envelope,
        this.context.householdKey,
        this.context.state,
        { validate: isNearbyPayload },
      );
      if (payload.kind === 'operations') {
        let acceptedIds: string[] = [];
        if (this.options.applyOperations) {
          if (await this.options.applyOperations(payload.operations)) {
            acceptedIds = payload.operations.map(operationId).filter((id): id is string => id !== null);
          }
        } else {
          for (const operation of payload.operations) {
            const id = operationId(operation);
            if (id === null) continue;
            const result = await this.options.applyOperation(operation);
            if (result === 'applied' || result === 'duplicate') acceptedIds.push(id);
            else this.report(new Error(`Rejected nearby operation ${id}`));
          }
        }
        if (acceptedIds.length > 0) {
          await this.send(peer, {
            v: NEARBY_PROTOCOL_VERSION,
            kind: 'ack',
            batchId: payload.batchId,
            operationIds: acceptedIds,
          });
          this.markSyncSuccessful();
        }
      } else {
        this.applyAcknowledgement(peer, payload);
      }
      this.seenMessageIds.add(envelope.messageId);
      await this.persist();
      void this.flush();
    } catch (error) {
      this.report(asError(error));
    }
  }

  private applyAcknowledgement(peer: NearbyPeer, ack: NearbyOperationAck): void {
    if (!this.inFlight || ack.batchId !== this.inFlight.batchId
      || peer.deviceId !== this.inFlight.peerDeviceId
      || ack.operationIds.some((id) => !this.inFlight!.operationIds.includes(id))) {
      throw new Error('Ignored uncorrelated nearby acknowledgement');
    }
    const acknowledged = new Set(ack.operationIds);
    this.pending = this.pending.filter((operation) => {
      const id = operationId(operation);
      return id === null || !acknowledged.has(id);
    });
    const remaining = this.inFlight.operationIds.filter((id) => !acknowledged.has(id));
    this.inFlight = remaining.length > 0 ? { ...this.inFlight, operationIds: remaining } : null;
    if (!this.inFlight) this.markSyncSuccessful();
  }

  private async flush(): Promise<void> {
    if (!this.foreground || !this.started || !this.isLocalDeviceAuthorized()
      || !this.peer || this.pending.length === 0 || this.flushing) return;
    this.flushing = true;
    try {
      if (!this.inFlight || this.inFlight.peerDeviceId !== this.peer.deviceId) {
        const operationIds = this.pending.slice(0, 100).map(operationId).filter((id): id is string => id !== null);
        if (operationIds.length === 0) return;
        this.inFlight = { batchId: randomUUID(), peerDeviceId: this.peer.deviceId, operationIds };
        await this.persist();
      }
      const selected = new Set(this.inFlight.operationIds);
      await this.send(this.peer, {
        v: NEARBY_PROTOCOL_VERSION,
        kind: 'operations',
        batchId: this.inFlight.batchId,
        operations: this.pending.filter((operation) => {
          const id = operationId(operation);
          return id !== null && selected.has(id);
        }),
      });
    } catch (error) {
      this.report(asError(error));
    } finally {
      this.flushing = false;
    }
  }

  private async send(peer: NearbyPeer, payload: NearbyPayload): Promise<void> {
    const envelope = await createAuthenticatedEnvelope(
      payload,
      this.context.householdKey,
      this.context.state,
      this.context.deviceId,
    );
    await this.options.transport.send(peer, envelope);
  }

  private isAuthorizedPeer(peer: NearbyPeer): boolean {
    return peer.deviceId !== this.context.deviceId
      && peer.discoveryInfo.protocolVersion === NEARBY_PROTOCOL_VERSION
      && peer.discoveryInfo.householdTag === this.discoveryTag
      && this.context.state.devices.some((device) => device.deviceId === peer.deviceId && device.revokedAt === undefined);
  }

  private isLocalDeviceAuthorized(): boolean {
    return this.context.state.devices.some(
      (device) => device.deviceId === this.context.deviceId && device.revokedAt === undefined,
    );
  }

  private report(error: Error): void {
    this.options.onError?.(error);
  }

  private markSyncSuccessful(): void {
    this.lastSyncedAt = new Date().toISOString();
    this.options.onSyncSuccess?.(this.lastSyncedAt);
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loading) {
      this.loading = this.options.queueStore.load().then((snapshot) => {
        const merged = [...snapshot.pending, ...this.pending];
        this.pending = merged.filter((operation, index) => {
          const id = operationId(operation);
          return id !== null && merged.findIndex((candidate) => operationId(candidate) === id) === index;
        });
        snapshot.seenMessageIds.forEach((id) => this.seenMessageIds.add(id));
        this.inFlight = snapshot.inFlight;
        // Loading is also a revocation fence. This removes work persisted by a
        // phone before it was revoked, so it cannot be replayed if the app is
        // reopened with the old credential.
        if (!this.isLocalDeviceAuthorized()) {
          this.pending = [];
          this.inFlight = null;
        }
        this.loaded = true;
      }).finally(() => { this.loading = null; });
    }
    await this.loading;
  }

  private persist(): Promise<void> {
    const seenMessageIds = [...this.seenMessageIds].slice(-2048);
    return this.options.queueStore.save({ pending: this.pending, seenMessageIds, inFlight: this.inFlight });
  }
}

function operationId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const id = (value as { operationId?: unknown }).operationId;
  return typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(id) ? id : null;
}

function isNearbyPayload(value: unknown): value is NearbyPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  if (payload.v !== NEARBY_PROTOCOL_VERSION || typeof payload.batchId !== 'string' || payload.batchId.length > 128
    || (payload.kind !== 'operations' && payload.kind !== 'ack')) return false;
  if (payload.kind === 'operations') {
    return Array.isArray(payload.operations) && payload.operations.length <= 100
      && payload.operations.every((operation: unknown) => operationId(operation) !== null);
  }
  return Array.isArray(payload.operationIds) && payload.operationIds.length <= 100
    && payload.operationIds.every((id: unknown) => typeof id === 'string' && operationId({ operationId: id }) !== null);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function nearbyDiscoveryInfo(householdTag: string): NearbyPeer['discoveryInfo'] {
  return { protocolVersion: NEARBY_PROTOCOL_VERSION, householdTag };
}

export async function nearbyDiscoveryTag(householdKey: string): Promise<string> {
  const digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `nearby-discovery-v1:${householdKey}`);
  return digest.slice(0, 24);
}
