jest.mock('expo-crypto', () => {
  const crypto = require('crypto').webcrypto as Crypto;
  const BufferClass = require('buffer').Buffer as typeof Buffer;
  const source = (value: Uint8Array) => value as unknown as BufferSource;
  class Key {
    bytes: Uint8Array;
    constructor(value: Uint8Array) { this.bytes = value; }
    static async import(value: string) { return new Key(new Uint8Array(BufferClass.from(value, 'base64'))); }
  }
  class Sealed {
    bytes: Uint8Array;
    constructor(value: Uint8Array) { this.bytes = value; }
    static fromCombined(value: Uint8Array) { return new Sealed(value); }
    async combined() { return BufferClass.from(this.bytes).toString('base64'); }
  }
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex' },
    getRandomBytes: (length: number) => crypto.getRandomValues(new Uint8Array(length)),
    digestStringAsync: async (_algorithm: string, value: string) =>
      BufferClass.from(await crypto.subtle.digest('SHA-256', source(new TextEncoder().encode(value)))).toString('hex'),
    AESEncryptionKey: Key,
    AESSealedData: Sealed,
    aesEncryptAsync: async (plaintext: Uint8Array, key: Key, options: { additionalData?: Uint8Array }) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const imported = await crypto.subtle.importKey('raw', source(key.bytes), 'AES-GCM', false, ['encrypt']);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: source(iv), additionalData: options.additionalData && source(options.additionalData) }, imported, source(plaintext));
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv); combined.set(new Uint8Array(ciphertext), iv.length);
      return new Sealed(combined);
    },
    aesDecryptAsync: async (sealed: Sealed, key: Key, options: { additionalData?: Uint8Array }) => {
      const imported = await crypto.subtle.importKey('raw', source(key.bytes), 'AES-GCM', false, ['decrypt']);
      return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: source(sealed.bytes.slice(0, 12)), additionalData: options.additionalData && source(options.additionalData) }, imported, source(sealed.bytes.slice(12))));
    },
  };
});

import { DEFAULT_STATE } from '../store/schema';
import {
  exportRecoveryPack,
  openRecoveryPack,
  RecoveryPackError,
  restoreRecoveryPack,
  type RecoverySnapshot,
} from './recoveryPack';

const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const snapshot: RecoverySnapshot = {
  appState: DEFAULT_STATE,
  pairingState: {
    householdId: 'home',
    devices: [{ deviceId: 'owner', authorizedAt: 1 }],
    invitations: [],
  },
  householdKey: key,
  syncState: { versionVector: { owner: 2 } },
};

const authenticator = { authenticate: jest.fn(async () => true) };

describe('household recovery packs', () => {
  beforeEach(() => authenticator.authenticate.mockClear());

  it('requires device authentication and never puts the passphrase in the pack', async () => {
    authenticator.authenticate.mockResolvedValueOnce(false);
    await expect(exportRecoveryPack(snapshot, 'correct horse battery', authenticator))
      .rejects.toEqual(new RecoveryPackError('device-authentication-failed'));
    expect(authenticator.authenticate).toHaveBeenCalledWith('export-recovery');

    const pack = await exportRecoveryPack(snapshot, 'correct horse battery', authenticator);
    expect(pack).not.toContain('correct horse battery');
  });

  it('rejects wrong passphrases and tampering before returning staged state', async () => {
    const pack = await exportRecoveryPack(snapshot, 'correct horse battery', authenticator);
    await expect(openRecoveryPack(pack, 'wrong passphrase'))
      .rejects.toEqual(new RecoveryPackError('tampered-pack'));
    const envelope = JSON.parse(pack) as { sealed: string };
    envelope.sealed = `${envelope.sealed[0] === 'A' ? 'B' : 'A'}${envelope.sealed.slice(1)}`;
    const tampered = JSON.stringify(envelope);
    await expect(openRecoveryPack(tampered, 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('tampered-pack'));
  });

  it('rejects unsupported versions and malformed snapshots without opening them', async () => {
    const pack = await exportRecoveryPack(snapshot, 'correct horse battery', authenticator);
    const envelope = JSON.parse(pack) as { v: number };
    envelope.v = 99;
    await expect(openRecoveryPack(JSON.stringify(envelope), 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('unsupported-version'));
  });

  it('restores only after staging and rolls back the checkpoint on save failure', async () => {
    let live = { ...DEFAULT_STATE };
    let saves = 0;
    const store = {
      load: async () => live,
      save: async (next: typeof DEFAULT_STATE) => {
        saves += 1;
        if (saves === 1) throw new Error('disk full');
        live = next;
      },
    };
    const pack = await exportRecoveryPack(snapshot, 'correct horse battery', authenticator);
    await expect(restoreRecoveryPack(store, pack, 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('restore-failed'));
    expect(live).toEqual(DEFAULT_STATE);
    expect(saves).toBe(2);
  });
});
