jest.mock('expo-crypto', () => {
  const webcrypto = require('crypto').webcrypto as Crypto;
  const BufferClass = require('buffer').Buffer as typeof Buffer;
  const source = (value: Uint8Array) => value as Uint8Array<ArrayBuffer>;
  class Key {
    constructor(readonly mockData: Uint8Array) {}
    static async import(value: string): Promise<Key> { return new Key(new Uint8Array(BufferClass.from(value, 'base64'))); }
  }
  class Sealed {
    constructor(readonly mockData: Uint8Array) {}
    static fromCombined(value: Uint8Array): Sealed { return new Sealed(value); }
    async combined(): Promise<string> { return BufferClass.from(this.mockData).toString('base64'); }
  }
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (length: number) => webcrypto.getRandomValues(new Uint8Array(length)),
    randomUUID: () => 'batch-id-1',
    digestStringAsync: async (algorithm: string, value: string) => BufferClass.from(await webcrypto.subtle.digest(algorithm, new TextEncoder().encode(value))).toString('hex'),
    AESEncryptionKey: Key,
    AESSealedData: Sealed,
    aesEncryptAsync: async (plaintext: Uint8Array, key: Key, options: { additionalData?: Uint8Array }) => {
      const nonce = webcrypto.getRandomValues(new Uint8Array(12));
      const imported = await webcrypto.subtle.importKey('raw', source(key.mockData), 'AES-GCM', false, ['encrypt']);
      const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: source(nonce), additionalData: options.additionalData ? source(options.additionalData) : undefined }, imported, source(plaintext));
      const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
      combined.set(nonce); combined.set(new Uint8Array(ciphertext), nonce.length);
      return new Sealed(combined);
    },
    aesDecryptAsync: async (sealed: Sealed, key: Key, options: { additionalData?: Uint8Array }) => {
      const imported = await webcrypto.subtle.importKey('raw', source(key.mockData), 'AES-GCM', false, ['decrypt']);
      return new Uint8Array(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: source(sealed.mockData.slice(0, 12)), additionalData: options.additionalData ? source(options.additionalData) : undefined }, imported, source(sealed.mockData.slice(12))));
    },
  };
});

import { createAuthenticatedEnvelope, createHousehold, createInvitation, joinHousehold, openAuthenticatedEnvelope, revokeDevice } from '../domain/pairing';
import { NearbySyncCoordinator, nearbyDiscoveryInfo, nearbyDiscoveryTag, type NearbyPeer, type NearbyQueueSnapshot, type NearbyTransport } from './nearbySync';

function transportDouble() {
  let handlers: Parameters<NearbyTransport['start']>[0]['handlers'] | null = null;
  const sent: Array<{ peer: NearbyPeer; envelope: Parameters<NearbyTransport['send']>[1] }> = [];
  const transport: NearbyTransport = {
    start: async (options) => { handlers = options.handlers; },
    stop: async () => {},
    send: async (peer, envelope) => { sent.push({ peer, envelope }); },
  };
  return { transport, sent, handlers: () => handlers };
}

const peer = (householdTag: string): NearbyPeer => ({
  deviceId: 'partner',
  discoveryInfo: nearbyDiscoveryInfo(householdTag),
});

function queueStore(initial: NearbyQueueSnapshot = { pending: [], seenMessageIds: [], inFlight: null }) {
  let snapshot = initial;
  return {
    load: async () => snapshot,
    save: async (next: NearbyQueueSnapshot) => { snapshot = next; },
    snapshot: () => snapshot,
  };
}

describe('foreground nearby sync', () => {
  it('offers a safe manual sync result when the paired phone is absent', async () => {
    const owner = createHousehold('owner', 1);
    const doubled = transportDouble();
    const coordinator = new NearbySyncCoordinator({
      state: owner.state,
      householdKey: owner.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => 'applied',
      queueStore: queueStore(),
    });
    await coordinator.setForeground(true);
    await expect(coordinator.syncNow()).resolves.toBe('partner-absent');
    expect(doubled.sent).toHaveLength(0);
  });

  it('uses a live reconfigured membership and key context before reconnecting', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const revoked = revokeDevice(joined.state, 'owner', 'partner', 3);
    const doubled = transportDouble();
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => 'applied',
      queueStore: queueStore(),
    });
    await coordinator.setForeground(true);
    await coordinator.reconfigure({ state: revoked.state, householdKey: revoked.householdKey, deviceId: 'owner' });
    doubled.handlers()!.onPeer(peer(await nearbyDiscoveryTag(revoked.householdKey)));
    expect(doubled.sent).toHaveLength(0);
  });

  it('supports an atomic incoming batch and reports success only after commit', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const doubled = transportDouble();
    const commits: unknown[][] = [];
    const successes: string[] = [];
    let resolveCommit!: () => void;
    const commitApplied = new Promise<void>((resolve) => { resolveCommit = resolve; });
    let releaseSend!: () => void;
    const sendMayFinish = new Promise<void>((resolve) => { releaseSend = resolve; });
    const send = doubled.transport.send;
    doubled.transport.send = async (target, envelope) => {
      await sendMayFinish;
      await send(target, envelope);
    };
    let resolveSuccess!: (timestamp: string) => void;
    const successReported = new Promise<string>((resolve) => { resolveSuccess = resolve; });
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => 'rejected',
      applyOperations: async (operations) => {
        commits.push([...operations]);
        resolveCommit();
        return true;
      },
      onSyncSuccess: (timestamp) => {
        successes.push(timestamp);
        resolveSuccess(timestamp);
      },
      queueStore: queueStore(),
    });
    await coordinator.setForeground(true);
    const remote = peer(await nearbyDiscoveryTag(joined.householdKey));
    doubled.handlers()!.onPeer(remote);
    const batch = await createAuthenticatedEnvelope(
      { v: 1, kind: 'operations', batchId: 'remote-batch', operations: [{ operationId: 'good' }, { operationId: 'bad' }] },
      joined.householdKey, joined.state, 'partner', 'batch-atomic',
    );
    doubled.handlers()!.onMessage(remote, batch);
    await commitApplied;
    expect(successes).toHaveLength(0);
    releaseSend();
    await expect(successReported).resolves.toEqual(expect.any(String));
    expect(commits).toHaveLength(1);
    expect(commits[0]).toHaveLength(2);
    expect(successes).toHaveLength(1);
    expect(coordinator.lastSyncTimestamp).toBe(successes[0]);
  });

  it('fences a revoked phone queue before it can reconnect or replay work', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const revoked = revokeDevice(joined.state, 'owner', 'partner', 3);
    const doubled = transportDouble();
    const persisted = queueStore({
      pending: [{ operationId: 'old-credential-op' }],
      seenMessageIds: [],
      inFlight: { batchId: 'old-batch', peerDeviceId: 'owner', operationIds: ['old-credential-op'] },
    });
    const coordinator = new NearbySyncCoordinator({
      state: revoked.state,
      householdKey: revoked.householdKey,
      deviceId: 'partner',
      transport: doubled.transport,
      applyOperation: () => 'applied',
      queueStore: persisted,
    });

    coordinator.enqueue({ operationId: 'new-after-revoke' });
    await coordinator.setForeground(true);

    expect(coordinator.queuedOperationIds).toEqual([]);
    expect(persisted.snapshot().inFlight).toBeNull();
    expect(persisted.snapshot().pending).toEqual([]);
    expect(doubled.sent).toHaveLength(0);
  });

  it('does not discover or send while backgrounded, then queues and flushes after foreground', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const doubled = transportDouble();
    const applied: unknown[] = [];
    const persisted = queueStore({ pending: [{ operationId: 'persisted-op', kind: 'add-transaction' }], seenMessageIds: [], inFlight: null });
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: (operation) => { applied.push(operation); return 'applied'; },
      queueStore: persisted,
    });

    coordinator.enqueue({ operationId: 'op-1', kind: 'add-transaction' });
    expect(doubled.sent).toHaveLength(0);
    await coordinator.setForeground(true);
    doubled.handlers()!.onPeer(peer(await nearbyDiscoveryTag(joined.householdKey)));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(doubled.sent).toHaveLength(1);
    expect(coordinator.queuedOperationIds).toEqual(['persisted-op', 'op-1']);
  });

  it('commits a locally-authored operation to the outbox before sending it', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const doubled = transportDouble();
    let saved: NearbyQueueSnapshot = { pending: [], seenMessageIds: [], inFlight: null };
    let resolveSave!: () => void;
    const saveMayFinish = new Promise<void>((resolve) => { resolveSave = resolve; });
    let signalSaveStarted!: () => void;
    const saveStarted = new Promise<void>((resolve) => { signalSaveStarted = resolve; });
    const persisted = {
      load: async () => saved,
      save: async (snapshot: NearbyQueueSnapshot) => {
        signalSaveStarted();
        await saveMayFinish;
        saved = snapshot;
      },
    };
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => 'applied',
      queueStore: persisted,
    });

    await coordinator.setForeground(true);
    doubled.handlers()!.onPeer(peer(await nearbyDiscoveryTag(joined.householdKey)));
    const queued = coordinator.enqueueDurably([{ operationId: 'durable-before-send', kind: 'add-transaction' }]);
    await saveStarted;
    expect(doubled.sent).toHaveLength(0);

    resolveSave();
    await queued;
    expect(doubled.sent).toHaveLength(1);
  });

  it('rejects unpaired or wrong-household peers without exposing financial metadata', async () => {
    const owner = createHousehold('owner', 1);
    const doubled = transportDouble();
    const errors: Error[] = [];
    const coordinator = new NearbySyncCoordinator({
      state: owner.state,
      householdKey: owner.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => 'applied',
      queueStore: queueStore(),
      onError: (error) => errors.push(error),
    });
    await coordinator.setForeground(true);
    doubled.handlers()!.onPeer(peer('other-household-tag'));
    doubled.handlers()!.onPeer({ deviceId: 'stranger', discoveryInfo: nearbyDiscoveryInfo(await nearbyDiscoveryTag(owner.householdKey)) });
    expect(doubled.sent).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(JSON.stringify(doubled.handlers())).not.toContain('amount');
  });

  it('keeps a failed send queued and removes it only after an authenticated ack', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    let fail = true;
    const doubled = transportDouble();
    const originalSend = doubled.transport.send;
    doubled.transport.send = async (target, envelope) => {
      if (fail) { fail = false; throw new Error('peer unavailable'); }
      return originalSend(target, envelope);
    };
    const persisted = queueStore();
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => 'applied',
      queueStore: persisted,
    });
    coordinator.enqueue({ operationId: 'op-2', kind: 'add-transaction' });
    await coordinator.setForeground(true);
    const remote = peer(await nearbyDiscoveryTag(joined.householdKey));
    doubled.handlers()!.onPeer(remote);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(coordinator.queuedOperationIds).toEqual(['op-2']);
    doubled.handlers()!.onPeer(remote);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(doubled.sent).toHaveLength(1);
    const ack = await createAuthenticatedEnvelope(
      { v: 1, kind: 'ack', batchId: persisted.snapshot().inFlight!.batchId, operationIds: ['op-2'] },
      joined.householdKey, joined.state, 'partner', 'ack-1',
    );
    doubled.handlers()!.onMessage(remote, ack);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(coordinator.queuedOperationIds).toEqual([]);
  });

  it('ignores an authenticated acknowledgement that does not match the sent batch', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const doubled = transportDouble();
    const errors: Error[] = [];
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => 'applied',
      queueStore: queueStore(),
      onError: (error) => errors.push(error),
    });
    coordinator.enqueue({ operationId: 'op-correlated', kind: 'add-transaction' });
    await coordinator.setForeground(true);
    const remote = peer(await nearbyDiscoveryTag(joined.householdKey));
    doubled.handlers()!.onPeer(remote);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const wrongAck = await createAuthenticatedEnvelope(
      { v: 1, kind: 'ack', batchId: 'never-sent', operationIds: ['op-correlated'] },
      joined.householdKey, joined.state, 'partner', 'ack-wrong-batch',
    );
    doubled.handlers()!.onMessage(remote, wrongAck);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(coordinator.queuedOperationIds).toEqual(['op-correlated']);
    expect(errors.some((error) => error.message.includes('uncorrelated'))).toBe(true);
  });

  it('serializes rapid foreground transitions and ends in the latest state', async () => {
    const owner = createHousehold('owner', 1);
    const transitions: string[] = [];
    let releaseFirstStart: (() => void) | undefined;
    const transport: NearbyTransport = {
      start: async () => {
        transitions.push('start');
        if (!releaseFirstStart) await new Promise<void>((resolve) => { releaseFirstStart = resolve; });
      },
      stop: async () => { transitions.push('stop'); },
      send: async () => {},
    };
    const coordinator = new NearbySyncCoordinator({
      state: owner.state,
      householdKey: owner.householdKey,
      deviceId: 'owner',
      transport,
      applyOperation: () => 'applied',
      queueStore: queueStore(),
    });
    const active = coordinator.setForeground(true);
    const inactive = coordinator.setForeground(false);
    const activeAgain = coordinator.setForeground(true);
    while (!releaseFirstStart) await new Promise((resolve) => setTimeout(resolve, 0));
    releaseFirstStart?.();
    await Promise.all([active, inactive, activeAgain]);
    expect(transitions).toEqual(['start', 'stop', 'start']);
    expect(coordinator.isForeground).toBe(true);
  });

  it('acknowledges only applied or duplicate operations and keeps rejected data at the sender', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const doubled = transportDouble();
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: (operation) => (operation as { operationId: string }).operationId === 'bad' ? 'rejected' : 'duplicate',
      queueStore: queueStore(),
    });
    await coordinator.setForeground(true);
    const remote = peer(await nearbyDiscoveryTag(joined.householdKey));
    doubled.handlers()!.onPeer(remote);
    const batch = await createAuthenticatedEnvelope(
      { v: 1, kind: 'operations', batchId: 'remote-batch', operations: [{ operationId: 'good' }, { operationId: 'bad' }] },
      joined.householdKey,
      joined.state,
      'partner',
      'batch-1',
    );
    doubled.handlers()!.onMessage(remote, batch);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(doubled.sent).toHaveLength(1);
    const payload = await openAuthenticatedEnvelope<{ operationIds: string[] }>(
      doubled.sent[0].envelope,
      joined.householdKey,
      joined.state,
    );
    expect(payload.operationIds).toEqual(['good']);
  });
});
