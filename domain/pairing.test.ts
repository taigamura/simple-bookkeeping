jest.mock('expo-crypto', () => {
  const webcrypto = require('crypto').webcrypto as Crypto;
  const NodeBuffer = require('buffer').Buffer as typeof Buffer;
  const source = (value: Uint8Array) => value as Uint8Array<ArrayBuffer>;

  class TestKey {
    readonly data: Uint8Array;
    constructor(value: Uint8Array) { this.data = value; }
    static async import(value: string): Promise<TestKey> {
      return new TestKey(new Uint8Array(NodeBuffer.from(value, 'base64')));
    }
  }

  class TestSealed {
    readonly data: Uint8Array;
    constructor(value: Uint8Array) { this.data = value; }
    static fromCombined(value: string): TestSealed {
      return new TestSealed(new Uint8Array(NodeBuffer.from(value, 'base64')));
    }
    async combined(): Promise<string> {
      return NodeBuffer.from(this.data).toString('base64');
    }
  }

  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (length: number) => webcrypto.getRandomValues(new Uint8Array(length)),
    digestStringAsync: async (algorithm: string, value: string) => {
      const digest = await webcrypto.subtle.digest(algorithm, new TextEncoder().encode(value));
      return NodeBuffer.from(digest).toString('hex');
    },
    AESEncryptionKey: TestKey,
    AESSealedData: TestSealed,
    aesEncryptAsync: async (plaintext: Uint8Array, key: TestKey, options: { additionalData?: Uint8Array }) => {
      const nonce = webcrypto.getRandomValues(new Uint8Array(12));
      const imported = await webcrypto.subtle.importKey('raw', source(key.data), 'AES-GCM', false, ['encrypt']);
      const ciphertext = await webcrypto.subtle.encrypt(
        { name: 'AES-GCM', iv: source(nonce), additionalData: options.additionalData ? source(options.additionalData) : undefined },
        imported,
        source(plaintext),
      );
      const combined = new Uint8Array(nonce.length + ciphertext.byteLength);
      combined.set(nonce);
      combined.set(new Uint8Array(ciphertext), nonce.length);
      return new TestSealed(combined);
    },
    aesDecryptAsync: async (sealed: TestSealed, key: TestKey, options: { additionalData?: Uint8Array }) => {
      const nonce = sealed.data.slice(0, 12);
      const ciphertext = sealed.data.slice(12);
      const imported = await webcrypto.subtle.importKey('raw', source(key.data), 'AES-GCM', false, ['decrypt']);
      const plaintext = await webcrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: source(nonce), additionalData: options.additionalData ? source(options.additionalData) : undefined },
        imported,
        source(ciphertext),
      );
      return new Uint8Array(plaintext);
    },
  };
});

import {
  createAuthenticatedEnvelope,
  createHousehold,
  createInvitation,
  deleteHouseholdKey,
  joinHousehold,
  openAuthenticatedEnvelope,
  loadHouseholdKey,
  PairingError,
  revokeDevice,
  storeHouseholdKey,
} from './pairing';

const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const otherKey = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';

describe('household pairing', () => {
  const now = 1_900_000_000_000;

  it('creates a one-use invitation and authorizes exactly one additional device', async () => {
    const created = createHousehold('owner', now);
    const invitation = await createInvitation(created.state, created.householdKey, 'owner', now);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 1);

    expect(joined.householdKey).toBe(created.householdKey);
    expect(joined.state.devices).toHaveLength(2);
    await expect(createInvitation(created.state, created.householdKey, 'unknown', now))
      .rejects.toEqual(new PairingError('device-not-authorized'));
    await expect(joinHousehold(joined.state, invitation.qrPayload, invitation.invitation.matchingCode, 'third', now + 2))
      .rejects.toEqual(new PairingError('invitation-used'));
  });

  it('rejects wrong codes, expired invitations, and replay', async () => {
    const created = createHousehold('owner', now);
    const invitation = await createInvitation(created.state, created.householdKey, 'owner', now, 10);

    await expect(joinHousehold(invitation.state, invitation.qrPayload, '000000', 'partner', now + 1))
      .rejects.toEqual(new PairingError('matching-code-mismatch'));
    await expect(joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 10))
      .rejects.toEqual(new PairingError('expired-invitation'));
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 2);
    await expect(joinHousehold(joined.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner-2', now + 3))
      .rejects.toEqual(new PairingError('invitation-used'));
  });

  it('binds the QR household key to the owner-side invitation commitment', async () => {
    const created = createHousehold('owner', now);
    const invitation = await createInvitation(created.state, created.householdKey, 'owner', now);
    const forged = JSON.parse(invitation.qrPayload) as Record<string, unknown>;
    forged.householdKey = otherKey;

    await expect(joinHousehold(
      invitation.state,
      JSON.stringify(forged),
      invitation.invitation.matchingCode,
      'partner',
      now + 1,
    )).rejects.toEqual(new PairingError('invalid-invitation'));
    expect(invitation.invitation.matchingCode).toMatch(/^\d{6}$/);
  });

  it('rotates the key when revoking a device and keeps secrets out of pairing state', async () => {
    const created = createHousehold('owner', now);
    const invitation = await createInvitation(created.state, created.householdKey, 'owner', now);
    const joined = await joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 1);
    const revoked = revokeDevice(joined.state, 'owner', 'partner', now + 2);
    const next = await createInvitation(revoked.state, revoked.householdKey, 'owner', now + 3);

    await expect(joinHousehold(next.state, next.qrPayload, next.invitation.matchingCode, 'partner', now + 4))
      .rejects.toEqual(new PairingError('device-revoked'));
    expect(revoked.householdKey).not.toBe(created.householdKey);
    expect(JSON.stringify(revoked.state)).not.toContain(created.householdKey);
    expect(JSON.stringify(revoked.state)).not.toContain(revoked.householdKey);
  });
});

describe('household keychain and authenticated envelopes', () => {
  const values = new Map<string, string>();
  const keychain = {
    get: async (_service: string, account: string) => values.get(account) ?? null,
    set: async (_service: string, account: string, secret: string) => { values.set(account, secret); },
    delete: async (_service: string, account: string) => { values.delete(account); },
  };

  beforeEach(() => values.clear());

  it('stores secrets only through the KeychainSecretStore seam', async () => {
    await storeHouseholdKey(keychain, 'h1', key);
    expect(await loadHouseholdKey(keychain, 'h1')).toBe(key);
    await deleteHouseholdKey(keychain, 'h1');
    expect(await loadHouseholdKey(keychain, 'h1')).toBeNull();
  });

  it('authenticates household and active sender metadata and rejects tampering', async () => {
    const state = { householdId: 'h1', devices: [{ deviceId: 'owner', authorizedAt: 1 }], invitations: [] };
    const envelope = await createAuthenticatedEnvelope({ operation: 'add' }, key, state, 'owner', 'message-1');

    await expect(openAuthenticatedEnvelope(envelope, key, state)).resolves.toEqual({ operation: 'add' });
    const seenMessageIds = new Set<string>();
    await openAuthenticatedEnvelope(envelope, key, state, { seenMessageIds });
    await expect(openAuthenticatedEnvelope(envelope, key, state, { seenMessageIds }))
      .rejects.toEqual(new PairingError('replayed-message'));
    const tampered = `${envelope.sealed[0] === 'A' ? 'B' : 'A'}${envelope.sealed.slice(1)}`;
    await expect(openAuthenticatedEnvelope({ ...envelope, sealed: tampered }, key, state))
      .rejects.toThrow('Unauthenticated');
    await expect(openAuthenticatedEnvelope(envelope, otherKey, state)).rejects.toThrow('Unauthenticated');
    await expect(openAuthenticatedEnvelope(envelope, key, { ...state, householdId: 'other' }))
      .rejects.toEqual(new PairingError('wrong-household'));
    await expect(createAuthenticatedEnvelope({}, key, state, 'unknown')).rejects.toEqual(new PairingError('device-not-authorized'));
  });

  it('rejects a revoked sender and envelopes encrypted under the pre-rotation key', async () => {
    const active = {
      householdId: 'h1',
      devices: [{ deviceId: 'owner', authorizedAt: 1 }, { deviceId: 'partner', authorizedAt: 2 }],
      invitations: [],
    };
    const oldEnvelope = await createAuthenticatedEnvelope({ operation: 'add' }, key, active, 'partner');
    const revoked = revokeDevice(active, 'owner', 'partner', 3);

    await expect(createAuthenticatedEnvelope({}, revoked.householdKey, revoked.state, 'partner'))
      .rejects.toEqual(new PairingError('device-not-authorized'));
    await expect(openAuthenticatedEnvelope(oldEnvelope, revoked.householdKey, revoked.state))
      .rejects.toEqual(new PairingError('device-not-authorized'));
  });
});
