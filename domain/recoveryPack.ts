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
  getRandomBytes,
} from 'expo-crypto';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

import type { HouseholdPairingState } from './pairing';
import type { AppState } from '../store/schema';

export const RECOVERY_PACK_VERSION = 1;
const KDF_ITERATIONS = 600_000;
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
  load(): Promise<RecoverySnapshot>;
  save(snapshot: RecoverySnapshot): Promise<void>;
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
  kdf: 'PBKDF2-HMAC-SHA-256';
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

async function passphraseKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<AESEncryptionKey> {
  if (passphrase.length < 8) throw new RecoveryPackError('invalid-passphrase');
  const bytes = pbkdf2(sha256, new TextEncoder().encode(passphrase), salt, { c: iterations, dkLen: 32 });
  return AESEncryptionKey.import(bytesToBase64(bytes), 'base64') as Promise<AESEncryptionKey>;
}

function aad(envelope: Omit<RecoveryPackEnvelope, 'sealed'>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope));
}

function isJsonSafe(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.keys(value).every((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
      && isJsonSafe((value as Record<string, unknown>)[key], seen));
  seen.delete(value);
  return valid;
}

function isSyncState(value: unknown, householdId: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const versionVector = state.versionVector;
  return state.householdId === householdId
    && Array.isArray(state.entries)
    && Array.isArray(state.appliedOperations)
    && !!versionVector && typeof versionVector === 'object' && !Array.isArray(versionVector)
    && !!state.transactionOperations && typeof state.transactionOperations === 'object'
    && !!state.history && typeof state.history === 'object'
    && !!state.tombstones && typeof state.tombstones === 'object'
    && !!state.attribution && typeof state.attribution === 'object';
}

function isPairingState(value: unknown): value is HouseholdPairingState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const pairing = value as Record<string, unknown>;
  if (typeof pairing.householdId !== 'string' || pairing.householdId.length === 0
    || !Array.isArray(pairing.devices) || pairing.devices.length < 1 || pairing.devices.length > 2
    || !Array.isArray(pairing.invitations)) return false;
  const devices = pairing.devices as unknown[];
  return devices.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const device = item as Record<string, unknown>;
    return typeof device.deviceId === 'string' && device.deviceId.length > 0
      && typeof device.authorizedAt === 'number' && Number.isFinite(device.authorizedAt)
      && (device.revokedAt === undefined || (typeof device.revokedAt === 'number' && Number.isFinite(device.revokedAt)));
  }) && (pairing.invitations as unknown[]).every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const invitation = item as Record<string, unknown>;
    return typeof invitation.invitationId === 'string' && invitation.invitationId.length > 0
      && invitation.householdId === pairing.householdId
      && typeof invitation.token === 'string' && typeof invitation.matchingCode === 'string'
      && typeof invitation.keyCommitment === 'string'
      && typeof invitation.issuedAt === 'number' && Number.isFinite(invitation.issuedAt)
      && typeof invitation.expiresAt === 'number' && Number.isFinite(invitation.expiresAt)
      && (invitation.usedAt === undefined || (typeof invitation.usedAt === 'number' && Number.isFinite(invitation.usedAt)));
  });
}

function validateSnapshot(snapshot: RecoverySnapshot): RecoverySnapshot {
  if (!isJsonSafe(snapshot)) throw new RecoveryPackError('invalid-pack');
  // Resolve lazily: store/schema imports the domain barrel for its field
  // validators, and recovery is itself exported by that barrel.
  const { normalizePersistedState } = require('../store/schema') as {
    normalizePersistedState(value: unknown): AppState | null;
  };
  const appState = normalizePersistedState(snapshot?.appState);
  if (!appState || !isAppState(appState)) throw new RecoveryPackError('invalid-pack');
  if (!snapshot.householdKey || !/^[A-Za-z0-9+/]{43}=$/.test(snapshot.householdKey)) {
    throw new RecoveryPackError('invalid-pack');
  }
  const pairingState = snapshot.pairingState;
  const active = pairingState && Array.isArray(pairingState.devices)
    ? pairingState.devices.filter((device) => device.revokedAt === undefined)
    : [];
  if (!isPairingState(pairingState) || active.length !== 1 || !isSyncState(snapshot.syncState, pairingState.householdId)) {
    throw new RecoveryPackError('invalid-pack');
  }
  return {
    appState,
    pairingState: JSON.parse(JSON.stringify(pairingState)) as HouseholdPairingState,
    householdKey: snapshot.householdKey,
    syncState: JSON.parse(JSON.stringify(snapshot.syncState)),
  };
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
  const staged = validateSnapshot(snapshot);
  const salt = bytesToBase64(getRandomBytes(16));
  const metadata: Omit<RecoveryPackEnvelope, 'sealed'> = {
    v: RECOVERY_PACK_VERSION,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-HMAC-SHA-256',
    iterations: KDF_ITERATIONS,
    salt,
  };
  const key = await passphraseKey(passphrase, base64ToBytes(salt), KDF_ITERATIONS);
  const sealed = await aesEncryptAsync(
    new TextEncoder().encode(JSON.stringify(staged)),
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
  if (envelope.kdf !== 'PBKDF2-HMAC-SHA-256' || envelope.iterations !== KDF_ITERATIONS || typeof envelope.salt !== 'string'
    || typeof envelope.sealed !== 'string' || pack.length > MAX_PACK_BYTES) throw new RecoveryPackError('unsupported-version');
  try {
    const key = await passphraseKey(passphrase, base64ToBytes(envelope.salt), envelope.iterations);
    const sealed = AESSealedData.fromCombined(base64ToBytes(envelope.sealed), { ivLength: 12, tagLength: 16 });
    const plaintext = await aesDecryptAsync(sealed, key, { additionalData: aad({
      v: envelope.v, algorithm: envelope.algorithm, kdf: envelope.kdf, iterations: envelope.iterations, salt: envelope.salt,
    }) });
    const snapshot = JSON.parse(new TextDecoder().decode(plaintext)) as RecoverySnapshot;
    return validateSnapshot(snapshot);
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
    await store.save(staged);
  } catch {
    try { await store.save(checkpoint); } catch { /* preserve the original failure */ }
    throw new RecoveryPackError('restore-failed');
  }
  return staged;
}
