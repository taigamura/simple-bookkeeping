/**
 * The application-facing household runtime.  Pairing metadata is deliberately
 * kept separate from the ledger store: it contains no household key, while the
 * key itself is held by the Keychain adapter supplied by the host.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  addLocalTransaction,
  applySyncOperations,
  createHousehold,
  createInvitation,
  createSyncState,
  deleteLocalTransaction,
  editLocalTransaction,
  householdSyncStatus,
  loadHouseholdKey,
  revokeDevice,
  restoreLocalTransaction,
  storeHouseholdKey,
  syncHistoryRows,
  type HouseholdPairingState,
  type KeychainSecretStore,
  type SyncHistoryRow,
  type SyncState,
  type SyncStatusModel,
  type Transaction,
  exportRecoveryPack,
  restoreRecoveryPack,
  type DeviceAuthenticator,
} from '../domain';
import { stableId } from '../domain/identity';
import type { AppState } from '../store';
import { createNativeNearbyTransport, bindNearbySyncToForeground } from './nearbyNativeTransport';
import { createNearbyQueueStore } from './nearbyQueueStore';
import { NearbySyncCoordinator } from './nearbySync';

const METADATA_KEY = 'kaji:household-runtime:v1';

export interface HouseholdRuntimeMetadata {
  deviceId: string;
  pairingState: HouseholdPairingState;
  syncState: SyncState;
  lastSyncedAt?: string;
}

export interface HouseholdRuntimeStorage {
  load(): Promise<HouseholdRuntimeMetadata | null>;
  save(metadata: HouseholdRuntimeMetadata): Promise<void>;
}

export const householdRuntimeStorage: HouseholdRuntimeStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(METADATA_KEY);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as HouseholdRuntimeMetadata;
      if (!value || typeof value.deviceId !== 'string' || !value.pairingState || !value.syncState) return null;
      return value;
    } catch { return null; }
  },
  save: (metadata) => AsyncStorage.setItem(METADATA_KEY, JSON.stringify(metadata)),
};

export interface HouseholdRuntimeOptions {
  keychain: KeychainSecretStore;
  storage?: HouseholdRuntimeStorage;
  /** Atomically persists incoming ledger changes before an acknowledgement. */
  applyIncomingEntries: (entries: Transaction[]) => Promise<boolean>;
  onChange?: () => void;
}

/**
 * Owns the live coordinator and its non-secret checkpoint.  Creating the
 * first local household is intentional: it establishes one recoverable owner
 * slot, but it is not reported as "paired" until a second device is active.
 */
export class HouseholdRuntime {
  private readonly storage: HouseholdRuntimeStorage;
  private metadata: HouseholdRuntimeMetadata | null = null;
  private coordinator: NearbySyncCoordinator | null = null;
  private stopForeground: (() => void) | null = null;
  private transportError: string | undefined;

  constructor(private readonly options: HouseholdRuntimeOptions) {
    this.storage = options.storage ?? householdRuntimeStorage;
  }

  get ready() { return this.metadata !== null; }
  get pairingState() { return this.metadata?.pairingState; }
  get deviceId() { return this.metadata?.deviceId; }
  get history(): SyncHistoryRow[] { return this.metadata ? syncHistoryRows(this.metadata.syncState) : []; }
  get model(): SyncStatusModel {
    const activeDevices = this.metadata?.pairingState.devices.filter((device) => device.revokedAt === undefined).length ?? 0;
    return householdSyncStatus({
      paired: activeDevices === 2,
      foreground: this.coordinator?.isForeground ?? true,
      partnerPresent: this.coordinator?.hasPartner ?? false,
      queuedOperationCount: this.coordinator?.queuedOperationIds.length ?? 0,
      lastSyncedAt: this.metadata?.lastSyncedAt,
      error: this.transportError,
    });
  }

  async start(entries: Transaction[]): Promise<void> {
    const stored = await this.storage.load();
    if (stored) {
      const key = await loadHouseholdKey(this.options.keychain, stored.pairingState.householdId);
      if (key) {
        this.metadata = stored;
        this.installCoordinator(key);
        return;
      }
    }
    const deviceId = stableId();
    const created = createHousehold(deviceId);
    this.metadata = { deviceId, pairingState: created.state, syncState: createSyncState(created.state.householdId, entries) };
    await storeHouseholdKey(this.options.keychain, created.state.householdId, created.householdKey);
    await this.persist();
    this.installCoordinator(created.householdKey);
  }

  dispose(): void {
    this.stopForeground?.();
    this.stopForeground = null;
    this.coordinator = null;
  }

  async createInvitation() {
    const metadata = this.requireMetadata();
    const key = await this.requireKey();
    const result = await createInvitation(metadata.pairingState, key, metadata.deviceId);
    this.metadata = { ...metadata, pairingState: result.state };
    await this.persist();
    this.changed();
    return result;
  }

  async revoke(deviceId: string): Promise<void> {
    const metadata = this.requireMetadata();
    await this.requireKey();
    const result = revokeDevice(metadata.pairingState, metadata.deviceId, deviceId);
    await storeHouseholdKey(this.options.keychain, result.state.householdId, result.householdKey);
    this.metadata = { ...metadata, pairingState: result.state };
    await this.persist();
    this.coordinator?.reconfigure({ state: result.state, householdKey: result.householdKey, deviceId: metadata.deviceId });
    if (result.state.devices.filter((device) => device.revokedAt === undefined).length < 2) {
      this.stopForeground?.();
      this.stopForeground = null;
    }
    this.changed();
  }

  /** Queue only durable local ledger deltas; device preferences never enter sync. */
  async observeEntries(entries: Transaction[]): Promise<void> {
    const metadata = this.metadata;
    if (!metadata || sameEntries(metadata.syncState.entries, entries)) return;
    let syncState = metadata.syncState;
    const previous = new Map(syncState.entries.map((entry) => [entry.id, entry]));
    const next = new Map(entries.map((entry) => [entry.id, entry]));
    const operations: unknown[] = [];
    for (const entry of previous.values()) {
      if (!next.has(entry.id)) {
        const result = deleteLocalTransaction(syncState, metadata.deviceId, entry.id);
        syncState = result.state; operations.push(result.operation);
      }
    }
    for (const entry of next.values()) {
      const before = previous.get(entry.id);
      if (!before) {
        const result = addLocalTransaction(syncState, metadata.deviceId, entry);
        syncState = result.state; operations.push(result.operation);
      } else if (JSON.stringify(before) !== JSON.stringify(entry)) {
        const result = editLocalTransaction(syncState, metadata.deviceId, entry);
        syncState = result.state; operations.push(result.operation);
      }
    }
    // The outbox is committed first. If the app dies before the sync
    // checkpoint write below, the next observation deterministically rebuilds
    // the same operation IDs and retries this durable queue entry. Reversing
    // the order leaves an irrecoverable window where metadata says an edit was
    // observed but no peer can ever receive it.
    await this.requireCoordinator().enqueueDurably(operations);
    this.metadata = { ...metadata, syncState };
    await this.persist();
    this.changed();
  }

  async syncNow(): Promise<void> {
    const result = await this.coordinator?.syncNow();
    if (result === 'partner-absent') this.transportError = 'partner-absent';
    this.changed();
  }

  async restore(transactionId: string, operationId: string): Promise<Transaction | null> {
    const metadata = this.requireMetadata();
    try {
      const result = restoreLocalTransaction(metadata.syncState, metadata.deviceId, transactionId, operationId);
      if (!await this.options.applyIncomingEntries(result.state.entries)) return null;
      await this.requireCoordinator().enqueueDurably([result.operation]);
      this.metadata = { ...metadata, syncState: result.state };
      await this.persist();
      this.changed();
      return result.transaction;
    } catch {
      this.transportError = 'rollback';
      this.changed();
      return null;
    }
  }

  async exportRecovery(appState: AppState, passphrase: string, authenticator: DeviceAuthenticator): Promise<string> {
    const metadata = this.requireMetadata();
    const key = await this.requireKey();
    // A recovery pack deliberately restores one fresh owner slot, not both
    // historical devices. It therefore cannot resurrect a revoked/lost peer.
    const local = metadata.pairingState.devices.find((device) => device.deviceId === metadata.deviceId && device.revokedAt === undefined);
    if (!local) throw new Error('This device is no longer authorized');
    return exportRecoveryPack({
      appState,
      pairingState: { householdId: metadata.pairingState.householdId, devices: [local], invitations: [] },
      householdKey: key,
      syncState: metadata.syncState,
    }, passphrase, authenticator);
  }

  async restoreRecovery(
    currentAppState: AppState,
    pack: string,
    passphrase: string,
    authenticator: DeviceAuthenticator,
    saveAppState: (state: AppState) => Promise<boolean>,
  ): Promise<boolean> {
    const current = this.requireMetadata();
    const currentKey = await this.requireKey();
    const checkpoint = {
      appState: currentAppState,
      pairingState: current.pairingState,
      householdKey: currentKey,
      syncState: current.syncState,
    };
    const restoredDeviceId = stableId();
    await restoreRecoveryPack({
      load: async () => checkpoint,
      save: async (snapshot) => {
        const rollingBack = snapshot === checkpoint;
        const owner = snapshot.pairingState.devices.find((device) => device.revokedAt === undefined);
        if (!owner) throw new Error('Recovery pack has no active owner');
        const deviceId = rollingBack ? current.deviceId : restoredDeviceId;
        const pairingState = rollingBack
          ? current.pairingState
          : { ...snapshot.pairingState, devices: [{ ...owner, deviceId }], invitations: [] };
        const syncState = (rollingBack ? current.syncState : snapshot.syncState) as SyncState;
        if (!await saveAppState(snapshot.appState)) throw new Error('state save failed');
        await storeHouseholdKey(this.options.keychain, pairingState.householdId, snapshot.householdKey);
        this.metadata = { deviceId, pairingState, syncState };
        await this.persist();
        this.installCoordinator(snapshot.householdKey);
      },
    }, pack, passphrase, authenticator);
    return true;
  }

  private installCoordinator(key: string): void {
    const metadata = this.requireMetadata();
    this.stopForeground?.();
    this.coordinator = new NearbySyncCoordinator({
      state: metadata.pairingState,
      householdKey: key,
      deviceId: metadata.deviceId,
      transport: createNativeNearbyTransport(),
      queueStore: createNearbyQueueStore(metadata.pairingState.householdId, metadata.deviceId),
      applyOperation: () => 'rejected',
      applyOperations: async (operations) => {
        const current = this.requireMetadata();
        const result = applySyncOperations(current.syncState, operations);
        if (!result.accepted) { this.transportError = result.error ?? 'invalid-operation'; this.changed(); return false; }
        if (!await this.options.applyIncomingEntries(result.state.entries)) return false;
        this.metadata = { ...current, syncState: result.state };
        await this.persist();
        this.changed();
        return true;
      },
      onError: (error) => { this.transportError = error.message === 'partner-absent' ? 'partner-absent' : 'transport'; this.changed(); },
      onSyncSuccess: async (lastSyncedAt) => {
        if (!this.metadata) return;
        this.transportError = undefined;
        this.metadata = { ...this.metadata, lastSyncedAt };
        await this.persist();
        this.changed();
      },
    });
    // A one-phone household has an owner and can make an invitation, but no
    // nearby session is advertised until a second authorized phone exists.
    if (metadata.pairingState.devices.filter((device) => device.revokedAt === undefined).length === 2) {
      this.stopForeground = bindNearbySyncToForeground(this.coordinator);
    }
    this.changed();
  }

  private async requireKey(): Promise<string> {
    const metadata = this.requireMetadata();
    const key = await loadHouseholdKey(this.options.keychain, metadata.pairingState.householdId);
    if (!key) throw new Error('Household key is unavailable on this device');
    return key;
  }
  private requireMetadata(): HouseholdRuntimeMetadata {
    if (!this.metadata) throw new Error('Household runtime has not started');
    return this.metadata;
  }
  private requireCoordinator(): NearbySyncCoordinator {
    if (!this.coordinator) throw new Error('Household sync coordinator is unavailable');
    return this.coordinator;
  }
  private async persist() { if (this.metadata) await this.storage.save(this.metadata); }
  private changed() { this.options.onChange?.(); }
}

function sameEntries(left: Transaction[], right: Transaction[]) {
  return left.length === right.length && left.every((entry, index) => JSON.stringify(entry) === JSON.stringify(right[index]));
}
