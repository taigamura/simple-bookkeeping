/**
 * Offline household recovery packs.
 *
 * This module intentionally has no storage or UI dependency. The caller must
 * authenticate the device before export (and may do so before import), then
 * supplies the passphrase only for the duration of the operation. The
 * passphrase is never included in the pack or returned from this module.
 */
import {
  AESSealedData,
  AESEncryptionKey,
  aesDecryptAsync,
  aesEncryptAsync,
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytes,
} from 'expo-crypto';

import type { HouseholdPairingState } from './pairing';
import type { AppState } from '../store/schema';

export const RECOVERY_PACK_VERSION = 1;
const KDF_ITERATIONS = 1_000;
const MAX_PACK_BYTES = 4 * 1024 * 1024;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export interface RecoverySnapshot {
  appState: AppState;
  pairingState: HouseholdPairingState;
  householdKey: string;
  /** The authenticated sync state needed to resume a household. */
  syncState?: unknown;
}

export interface DeviceAuthenticator {
  authenticate(reason: 'export-recovery' | 'import-recovery'): Promise<boolean>;
}

export interface RecoveryStore {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
}

export type RecoveryFailure =
  | 'cancelled'
  | 'device-authentication-failed'
  | 'invalid-passphrase'
  | 'invalid-pack'
  | 'unsupported-version'
  | 'tampered-pack'
  | 'restore-failed';

export class RecoveryPackError extends Error {
  readonly code: RecoveryFailure;

  constructor(code: RecoveryFailure) {
    super(code);
    this.name = 'RecoveryPackError';
    this.code = code;
  }
}

interface RecoveryPackEnvelope {
  v: typeof RECOVERY_PACK_VERSION;
  algorithm: 'AES-GCM-256';
  kdf: 'SHA-256-ITERATED';
  iterations: typeof KDF_ITERATIONS;
  salt: string;
  sealed: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const hasB = index + 1 < bytes.length;
    const hasC = index + 2 < bytes.length;
    const b = hasB ? bytes[index + 1] : 0;
    const c = hasC ? bytes[index + 2] : 0;
    const value = (a << 16) | (b << 8) | c;
    output += BASE64[(value >>> 18) & 63];
    output += BASE64[(value >>> 12) & 63];
    output += hasB ? BASE64[(value >>> 6) & 63] : '=';
    output += hasC ? BASE64[value & 63] : '=';
  }
  return output;
}

function base64ToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length === 0 || value.length % 4 !== 0) {
    throw new RecoveryPackError('invalid-pack');
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let cursor = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64.indexOf(value[index]);
    const b = BASE64.indexOf(value[index + 1]);
    const c = value[index + 2] === '=' ? 0 : BASE64.indexOf(value[index + 2]);
    const d = value[index + 3] === '=' ? 0 : BASE64.indexOf(value[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new RecoveryPackError('invalid-pack');
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (cursor < output.length) output[cursor++] = (combined >>> 16) & 255;
    if (cursor < output.length) output[cursor++] = (combined >>> 8) & 255;
    if (cursor < output.length) output[cursor++] = combined & 255;
  }
  return output;
}

async function passphraseKey(passphrase: string, salt: string): Promise<AESEncryptionKey> {
  if (passphrase.length < 8) throw new RecoveryPackError('invalid-passphrase');
  let digest = `${salt}:${passphrase}`;
  for (let index = 0; index < KDF_ITERATIONS; index += 1) {
    digest = await digestStringAsync(CryptoDigestAlgorithm.SHA256, digest, { encoding: CryptoEncoding.HEX });
  }
  const bytes = new Uint8Array(digest.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
  return AESEncryptionKey.import(bytesToBase64(bytes), 'base64') as Promise<AESEncryptionKey>;
}

function aad(envelope: Omit<RecoveryPackEnvelope, 'sealed'>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope));
}

function assertSnapshot(snapshot: RecoverySnapshot): void {
  if (!snapshot || !isAppState(snapshot.appState)) throw new RecoveryPackError('invalid-pack');
  if (!snapshot.householdKey || !/^[A-Za-z0-9+/]{43}=$/.test(snapshot.householdKey)) {
    throw new RecoveryPackError('invalid-pack');
  }
  const pairingState = snapshot.pairingState;
  const active = pairingState && Array.isArray(pairingState.devices)
    ? pairingState.devices.filter((device) => device.revokedAt === undefined)
    : [];
  if (!pairingState || typeof pairingState.householdId !== 'string' || active.length === 0 || active.length > 2
    || !Array.isArray(pairingState.devices) || !Array.isArray(pairingState.invitations)) {
    throw new RecoveryPackError('invalid-pack');
  }
}

/** Structural validation keeps this domain module independent from the store barrel. */
function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  const household = state.household as Record<string, unknown> | undefined;
  const device = state.device as Record<string, unknown> | undefined;
  return Array.isArray(state.entries) && Array.isArray(state.recurrenceRules)
    && Array.isArray(state.expCats) && Array.isArray(state.incCats)
    && !!state.currency && typeof state.currency === 'object'
    && !!household && Array.isArray(household.entries) && Array.isArray(household.recurrenceRules)
    && Array.isArray(household.categories) && !!household.budgets && typeof household.budgets === 'object'
    && !!household.currency && typeof household.currency === 'object'
    && !!device && Array.isArray(device.expenseCategoryOrder) && Array.isArray(device.incomeCategoryOrder)
    && typeof device.theme === 'string' && typeof device.budgetMode === 'string'
    && typeof device.totalBudget === 'number' && typeof device.calendarView === 'string'
    && typeof device.motion === 'string' && typeof device.summaryGranularity === 'string';
}

export async function exportRecoveryPack(
  snapshot: RecoverySnapshot,
  passphrase: string,
  authenticator: DeviceAuthenticator,
): Promise<string> {
  let authenticated = false;
  try { authenticated = await authenticator.authenticate('export-recovery'); } catch { authenticated = false; }
  if (!authenticated) throw new RecoveryPackError('device-authentication-failed');
  assertSnapshot(snapshot);
  const salt = bytesToBase64(getRandomBytes(16));
  const metadata: Omit<RecoveryPackEnvelope, 'sealed'> = {
    v: RECOVERY_PACK_VERSION,
    algorithm: 'AES-GCM-256',
    kdf: 'SHA-256-ITERATED',
    iterations: KDF_ITERATIONS,
    salt,
  };
  const key = await passphraseKey(passphrase, salt);
  const sealed = await aesEncryptAsync(
    new TextEncoder().encode(JSON.stringify(snapshot)),
    key,
    { additionalData: aad(metadata) },
  );
  return JSON.stringify({ ...metadata, sealed: await sealed.combined('base64') as string });
}

export async function openRecoveryPack(pack: string, passphrase: string): Promise<RecoverySnapshot> {
  let envelope: RecoveryPackEnvelope;
  try { envelope = JSON.parse(pack) as RecoveryPackEnvelope; } catch { throw new RecoveryPackError('invalid-pack'); }
  if (typeof envelope !== 'object' || envelope === null) throw new RecoveryPackError('invalid-pack');
  if (envelope.v !== RECOVERY_PACK_VERSION || envelope.algorithm !== 'AES-GCM-256') {
    throw new RecoveryPackError('unsupported-version');
  }
  if (envelope.kdf !== 'SHA-256-ITERATED' || envelope.iterations !== KDF_ITERATIONS || typeof envelope.salt !== 'string'
    || typeof envelope.sealed !== 'string' || pack.length > MAX_PACK_BYTES) throw new RecoveryPackError('invalid-pack');
  try {
    const key = await passphraseKey(passphrase, envelope.salt);
    const sealed = AESSealedData.fromCombined(base64ToBytes(envelope.sealed), { ivLength: 12, tagLength: 16 });
    const plaintext = await aesDecryptAsync(sealed, key, { additionalData: aad({
      v: envelope.v, algorithm: envelope.algorithm, kdf: envelope.kdf, iterations: envelope.iterations, salt: envelope.salt,
    }) });
    const snapshot = JSON.parse(new TextDecoder().decode(plaintext)) as RecoverySnapshot;
    assertSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (error instanceof RecoveryPackError && error.code === 'invalid-passphrase') throw error;
    throw new RecoveryPackError('tampered-pack');
  }
}

/** Validate fully before save, and put the prior state back if persistence fails. */
export async function restoreRecoveryPack(
  store: RecoveryStore,
  pack: string,
  passphrase: string,
  authenticator?: DeviceAuthenticator,
): Promise<RecoverySnapshot> {
  if (authenticator) {
    let authenticated = false;
    try { authenticated = await authenticator.authenticate('import-recovery'); } catch { authenticated = false; }
    if (!authenticated) throw new RecoveryPackError('cancelled');
  }
  const staged = await openRecoveryPack(pack, passphrase);
  const checkpoint = await store.load();
  try {
    await store.save(staged.appState);
  } catch {
    try { await store.save(checkpoint); } catch { /* preserve the original failure */ }
    throw new RecoveryPackError('restore-failed');
  }
  return staged;
}
