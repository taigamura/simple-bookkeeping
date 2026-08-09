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

import { createAuthenticatedEnvelope, createHousehold, createInvitation, joinHousehold } from '../domain/pairing';
import { NearbySyncCoordinator, nearbyDiscoveryInfo, type NearbyPeer, type NearbyTransport } from './nearbySync';

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

const peer = (householdId: string): NearbyPeer => ({
  deviceId: 'partner',
  discoveryInfo: nearbyDiscoveryInfo(householdId),
});

describe('foreground nearby sync', () => {
  it('does not discover or send while backgrounded, then queues and flushes after foreground', async () => {
    const owner = createHousehold('owner', 1);
    const invitation = await createInvitation(owner.state, owner.householdKey, 'owner', 1);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', 2);
    const doubled = transportDouble();
    const applied: unknown[] = [];
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: (operation) => { applied.push(operation); return true; },
    });

    coordinator.enqueue({ operationId: 'op-1', kind: 'add-transaction' });
    expect(doubled.sent).toHaveLength(0);
    await coordinator.setForeground(true);
    doubled.handlers()!.onPeer(peer(joined.state.householdId));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(doubled.sent).toHaveLength(1);
    expect(coordinator.queuedOperationIds).toEqual(['op-1']);
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
      applyOperation: () => true,
      onError: (error) => errors.push(error),
    });
    await coordinator.setForeground(true);
    doubled.handlers()!.onPeer(peer('other-household'));
    doubled.handlers()!.onPeer({ deviceId: 'stranger', discoveryInfo: nearbyDiscoveryInfo(owner.state.householdId) });
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
    const coordinator = new NearbySyncCoordinator({
      state: joined.state,
      householdKey: joined.householdKey,
      deviceId: 'owner',
      transport: doubled.transport,
      applyOperation: () => true,
    });
    coordinator.enqueue({ operationId: 'op-2', kind: 'add-transaction' });
    await coordinator.setForeground(true);
    doubled.handlers()!.onPeer(peer(joined.state.householdId));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(coordinator.queuedOperationIds).toEqual(['op-2']);
    const ack = await createAuthenticatedEnvelope(
      { v: 1, kind: 'ack', operationIds: ['op-2'] }, joined.householdKey, joined.state, 'partner', 'ack-1',
    );
    doubled.handlers()!.onMessage(peer(joined.state.householdId), ack);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(coordinator.queuedOperationIds).toEqual([]);
  });
});
