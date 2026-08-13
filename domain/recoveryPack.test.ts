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
import { createSyncState } from './sync';
import * as pbkdf2Module from '@noble/hashes/pbkdf2';
import {
  exportRecoveryPack,
  openRecoveryPack,
  RecoveryPackError,
  restoreRecoveryPack,
  type RecoverySnapshot,
  type RecoveryStore,
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
  syncState: { ...createSyncState('home'), versionVector: { owner: 2 } },
};

const authenticator = { authenticate: jest.fn(async () => true) };

jest.setTimeout(120_000);

describe('household recovery packs', () => {
  let validPack: string;

  beforeAll(async () => {
    validPack = await exportRecoveryPack(snapshot, 'correct horse battery', authenticator);
  });

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
    await expect(openRecoveryPack(validPack, 'wrong passphrase'))
      .rejects.toEqual(new RecoveryPackError('tampered-pack'));
    const envelope = JSON.parse(validPack) as { sealed: string };
    envelope.sealed = `${envelope.sealed[0] === 'A' ? 'B' : 'A'}${envelope.sealed.slice(1)}`;
    const tampered = JSON.stringify(envelope);
    await expect(openRecoveryPack(tampered, 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('tampered-pack'));
  });

  it('rejects unsupported versions and malformed snapshots without opening them', async () => {
    const envelope = JSON.parse(validPack) as { v: number; kdf: string; iterations: number };
    expect(envelope.kdf).toBe('PBKDF2-HMAC-SHA-256');
    expect(envelope.iterations).toBeGreaterThanOrEqual(600_000);
    envelope.v = 99;
    await expect(openRecoveryPack(JSON.stringify(envelope), 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('unsupported-version'));

    const downgraded = { ...envelope, v: 1, kdf: 'SHA-256-ITERATED' };
    await expect(openRecoveryPack(JSON.stringify(downgraded), 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('unsupported-version'));

    const kdf = jest.spyOn(pbkdf2Module, 'pbkdf2');
    const iterationDowngraded = { ...envelope, iterations: 599_999 };
    await expect(openRecoveryPack(JSON.stringify(iterationDowngraded), 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('unsupported-version'));
    const iterationTampered = { ...envelope, iterations: 600_001 };
    await expect(openRecoveryPack(JSON.stringify(iterationTampered), 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('unsupported-version'));
    expect(kdf).not.toHaveBeenCalled();
    kdf.mockRestore();
  });

  it('restores only after staging and rolls back the checkpoint on save failure', async () => {
    const previous: RecoverySnapshot = {
      appState: { ...DEFAULT_STATE, theme: 'light' },
      pairingState: {
        householdId: 'old-home',
        devices: [{ deviceId: 'old-owner', authorizedAt: 1 }],
        invitations: [],
      },
      householdKey: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
      syncState: { versionVector: { 'old-owner': 7 } },
    };
    let live: RecoverySnapshot = previous;
    let saves = 0;
    const store: RecoveryStore = {
      load: async () => live,
      save: async (next: RecoverySnapshot) => {
        saves += 1;
        if (saves === 1) {
          live = { ...next, householdKey: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=' };
          throw new Error('disk full');
        }
        live = next;
      },
    };
    await expect(restoreRecoveryPack(store, validPack, 'correct horse battery'))
      .rejects.toEqual(new RecoveryPackError('restore-failed'));
    expect(live).toEqual(previous);
    expect(saves).toBe(2);
  });

  it('atomically installs the complete recovered household snapshot', async () => {
    let live: RecoverySnapshot = {
      ...snapshot,
      appState: { ...DEFAULT_STATE, theme: 'light' },
      pairingState: { householdId: 'old-home', devices: [{ deviceId: 'old-owner', authorizedAt: 1 }], invitations: [] },
      householdKey: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
      syncState: { versionVector: { 'old-owner': 1 } },
    };
    const store: RecoveryStore = { load: async () => live, save: async (next) => { live = next; } };
    const restored = await restoreRecoveryPack(store, validPack, 'correct horse battery');

    expect(restored).toEqual(snapshot);
    expect(live).toEqual(snapshot);
    expect(live.pairingState.devices).toEqual([{ deviceId: 'owner', authorizedAt: 1 }]);
  });

  it('normalizes app state and rejects malformed or over-capacity household state', async () => {
    const legacyEntry = { id: 'entry-1', y: 2026, m: 0, day: 2, type: 'expense', amount: 100, category: 'Food', note: 'Lunch' } as unknown as RecoverySnapshot['appState']['entries'][number];
    const normalized = await openRecoveryPack(
      await exportRecoveryPack({ ...snapshot, appState: { ...DEFAULT_STATE, entries: [legacyEntry] } }, 'correct horse battery', authenticator),
      'correct horse battery',
    );
    expect(normalized.appState.entries[0]).toEqual(expect.objectContaining({ timestamp: expect.any(String), repeat: 'never' }));

    await expect(exportRecoveryPack({ ...snapshot, pairingState: {
      ...snapshot.pairingState,
      devices: [{ deviceId: 'one', authorizedAt: 1 }, { deviceId: 'two', authorizedAt: 2 }, { deviceId: 'three', authorizedAt: 3 }],
    } }, 'correct horse battery', authenticator)).rejects.toEqual(new RecoveryPackError('invalid-pack'));
    await expect(exportRecoveryPack({ ...snapshot, pairingState: {
      ...snapshot.pairingState,
      devices: [{ deviceId: 'one', authorizedAt: 1 }, { deviceId: 'two', authorizedAt: 2 }],
    } }, 'correct horse battery', authenticator)).rejects.toEqual(new RecoveryPackError('invalid-pack'));
    await expect(exportRecoveryPack({ ...snapshot, syncState: { versionVector: { owner: 2 } } }, 'correct horse battery', authenticator))
      .rejects.toEqual(new RecoveryPackError('invalid-pack'));
  });

  it('leaves the complete live snapshot unchanged when device authentication is cancelled', async () => {
    const live: RecoverySnapshot = { ...snapshot, appState: { ...DEFAULT_STATE, theme: 'light' } };
    const store: RecoveryStore = { load: async () => live, save: jest.fn(async () => {}) };
    authenticator.authenticate.mockResolvedValueOnce(false);

    await expect(restoreRecoveryPack(store, validPack, 'correct horse battery', authenticator))
      .rejects.toEqual(new RecoveryPackError('cancelled'));
    expect(live).toEqual({ ...snapshot, appState: { ...DEFAULT_STATE, theme: 'light' } });
    expect(store.save).not.toHaveBeenCalled();
  });
});
