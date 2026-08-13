/**
 * Transport-independent household pairing and authenticated-envelope rules.
 *
 * Household keys are returned only for immediate Keychain storage. They are
 * never part of HouseholdPairingState, which is safe to persist with ordinary
 * application metadata.
 */
import {
  AESSealedData,
  AESEncryptionKey,
  aesDecryptAsync,
  aesEncryptAsync,
  CryptoDigestAlgorithm,
  digestStringAsync,
  getRandomBytes,
} from 'expo-crypto';

export const PAIRING_VERSION = 1;
export const DEFAULT_INVITATION_TTL_MS = 5 * 60 * 1000;
export const KEYCHAIN_SERVICE = 'kaji.household';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

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
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Invalid encoded secret');
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let cursor = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64.indexOf(value[index]);
    const b = BASE64.indexOf(value[index + 1]);
    const c = value[index + 2] === '=' ? 0 : BASE64.indexOf(value[index + 2]);
    const d = value[index + 3] === '=' ? 0 : BASE64.indexOf(value[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Invalid encoded secret');
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (cursor < output.length) output[cursor++] = (combined >>> 16) & 255;
    if (cursor < output.length) output[cursor++] = (combined >>> 8) & 255;
    if (cursor < output.length) output[cursor++] = combined & 255;
  }
  return output;
}

function randomToken(bytes = 32): string {
  return bytesToBase64(getRandomBytes(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function householdKey(): string {
  return bytesToBase64(getRandomBytes(32));
}

function validateHouseholdKey(value: string): void {
  if (base64ToBytes(value).length !== 32) throw new Error('Household key must be 256 bits');
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function matchingCode(): string {
  const bytes = getRandomBytes(4);
  const value = (((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3]) % 1_000_000;
  return value.toString().padStart(6, '0');
}

export interface DeviceAuthorization {
  deviceId: string;
  authorizedAt: number;
  revokedAt?: number;
}

export interface PendingInvitation {
  invitationId: string;
  householdId: string;
  token: string;
  matchingCode: string;
  keyCommitment: string;
  issuedAt: number;
  expiresAt: number;
  usedAt?: number;
}

export interface HouseholdPairingState {
  householdId: string;
  devices: DeviceAuthorization[];
  invitations: PendingInvitation[];
}

export interface HouseholdCreation {
  state: HouseholdPairingState;
  householdKey: string;
}

export interface InvitationCreation {
  state: HouseholdPairingState;
  invitation: PendingInvitation;
  qrPayload: string;
}

export interface JoinResult {
  state: HouseholdPairingState;
  householdKey: string;
  invitationId: string;
}

export interface RevocationResult {
  state: HouseholdPairingState;
  /** A fresh key that must replace the old key on every remaining device. */
  householdKey: string;
}

export type PairingFailure =
  | 'invalid-invitation'
  | 'expired-invitation'
  | 'invitation-used'
  | 'wrong-household'
  | 'matching-code-mismatch'
  | 'device-already-authorized'
  | 'device-revoked'
  | 'device-not-authorized'
  | 'device-limit-reached'
  | 'replayed-message'
  | 'invalid-envelope';

export class PairingError extends Error {
  readonly code: PairingFailure;

  constructor(code: PairingFailure) {
    super(code);
    this.name = 'PairingError';
    this.code = code;
  }
}

function id(): string {
  return randomToken(16);
}

interface ParsedInvitation {
  invitationId: string;
  householdId: string;
  token: string;
  expiresAt: number;
  householdKey: string;
}

function invitationPayload(invitation: PendingInvitation, key: string): string {
  return JSON.stringify({
    v: PAIRING_VERSION,
    id: invitation.invitationId,
    householdId: invitation.householdId,
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    householdKey: key,
  });
}

function parseInvitation(value: string): ParsedInvitation {
  try {
    if (value.length > 4096) throw new Error();
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.v !== PAIRING_VERSION || typeof parsed.id !== 'string' || typeof parsed.householdId !== 'string'
      || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number' || !Number.isSafeInteger(parsed.expiresAt)
      || typeof parsed.householdKey !== 'string') throw new Error();
    validateHouseholdKey(parsed.householdKey);
    return {
      invitationId: parsed.id,
      householdId: parsed.householdId,
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      householdKey: parsed.householdKey,
    };
  } catch {
    throw new PairingError('invalid-invitation');
  }
}

function invitationCommitment(invitation: Omit<PendingInvitation, 'keyCommitment'>, key: string): Promise<string> {
  return digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify({
      v: PAIRING_VERSION,
      id: invitation.invitationId,
      householdId: invitation.householdId,
      token: invitation.token,
      matchingCode: invitation.matchingCode,
      issuedAt: invitation.issuedAt,
      expiresAt: invitation.expiresAt,
      householdKey: key,
    }),
  );
}

export function createHousehold(ownerDeviceId: string, now = Date.now()): HouseholdCreation {
  if (!ownerDeviceId) throw new Error('A device ID is required');
  return {
    state: { householdId: id(), devices: [{ deviceId: ownerDeviceId, authorizedAt: now }], invitations: [] },
    householdKey: householdKey(),
  };
}

export async function createInvitation(
  state: HouseholdPairingState,
  key: string,
  inviterDeviceId: string,
  now = Date.now(),
  ttlMs = DEFAULT_INVITATION_TTL_MS,
): Promise<InvitationCreation> {
  if (!activeDevice(state, inviterDeviceId)) throw new PairingError('device-not-authorized');
  if (state.devices.filter((device) => device.revokedAt === undefined).length >= 2) throw new PairingError('device-limit-reached');
  if (ttlMs <= 0 || !Number.isFinite(ttlMs)) throw new Error('Invitation TTL must be positive');
  validateHouseholdKey(key);
  const unsigned = {
    invitationId: id(),
    householdId: state.householdId,
    token: randomToken(),
    matchingCode: matchingCode(),
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  const invitation: PendingInvitation = {
    ...unsigned,
    keyCommitment: await invitationCommitment(unsigned, key),
  };
  return {
    state: {
      ...state,
      invitations: [
        ...state.invitations.map((pending) => pending.usedAt === undefined ? { ...pending, usedAt: now } : pending),
        invitation,
      ],
    },
    invitation,
    qrPayload: invitationPayload(invitation, key),
  };
}

export async function joinHousehold(
  state: HouseholdPairingState,
  qrPayload: string,
  suppliedMatchingCode: string,
  deviceId: string,
  now = Date.now(),
): Promise<JoinResult> {
  const parsed = parseInvitation(qrPayload);
  if (parsed.householdId !== state.householdId) throw new PairingError('wrong-household');
  const invitation = state.invitations.find((candidate) => candidate.invitationId === parsed.invitationId
    && constantTimeEqual(candidate.token, parsed.token));
  if (!invitation) throw new PairingError('invalid-invitation');
  if (invitation.usedAt !== undefined) throw new PairingError('invitation-used');
  if (now >= invitation.expiresAt || parsed.expiresAt !== invitation.expiresAt) throw new PairingError('expired-invitation');
  if (!constantTimeEqual(invitation.matchingCode, suppliedMatchingCode)) throw new PairingError('matching-code-mismatch');
  const expectedCommitment = await invitationCommitment({
    invitationId: invitation.invitationId,
    householdId: invitation.householdId,
    token: invitation.token,
    matchingCode: invitation.matchingCode,
    issuedAt: invitation.issuedAt,
    expiresAt: invitation.expiresAt,
    usedAt: invitation.usedAt,
  }, parsed.householdKey);
  if (!constantTimeEqual(invitation.keyCommitment, expectedCommitment)) throw new PairingError('invalid-invitation');
  const existing = state.devices.find((device) => device.deviceId === deviceId);
  if (existing?.revokedAt !== undefined) throw new PairingError('device-revoked');
  if (existing) throw new PairingError('device-already-authorized');
  if (state.devices.filter((device) => device.revokedAt === undefined).length >= 2) throw new PairingError('device-limit-reached');
  return {
    state: {
      ...state,
      devices: [...state.devices, { deviceId, authorizedAt: now }],
      invitations: state.invitations.map((candidate) => candidate.invitationId === invitation.invitationId
        ? { ...candidate, usedAt: now }
        : candidate),
    },
    householdKey: parsed.householdKey,
    invitationId: invitation.invitationId,
  };
}

export function revokeDevice(
  state: HouseholdPairingState,
  callerDeviceId: string,
  deviceId: string,
  now = Date.now(),
): RevocationResult {
  if (!activeDevice(state, callerDeviceId) || callerDeviceId === deviceId) throw new PairingError('device-not-authorized');
  const device = state.devices.find((candidate) => candidate.deviceId === deviceId);
  if (!device || device.revokedAt !== undefined) throw new PairingError('device-not-authorized');
  return {
    state: {
      ...state,
      devices: state.devices.map((candidate) => candidate.deviceId === deviceId ? { ...candidate, revokedAt: now } : candidate),
      invitations: state.invitations.map((invitation) => invitation.usedAt === undefined ? { ...invitation, usedAt: now } : invitation),
    },
    householdKey: householdKey(),
  };
}

export interface KeychainSecretStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, secret: string): Promise<void>;
  delete(service: string, account: string): Promise<void>;
}

export function householdKeyAccount(householdId: string): string {
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(householdId)) throw new Error('Invalid household ID');
  return `household.${householdId}`;
}

export async function storeHouseholdKey(keychain: KeychainSecretStore, householdId: string, key: string): Promise<void> {
  validateHouseholdKey(key);
  await keychain.set(KEYCHAIN_SERVICE, householdKeyAccount(householdId), key);
}

export function loadHouseholdKey(keychain: KeychainSecretStore, householdId: string): Promise<string | null> {
  return keychain.get(KEYCHAIN_SERVICE, householdKeyAccount(householdId));
}

export function deleteHouseholdKey(keychain: KeychainSecretStore, householdId: string): Promise<void> {
  return keychain.delete(KEYCHAIN_SERVICE, householdKeyAccount(householdId));
}

export interface AuthenticatedEnvelope {
  v: 1;
  algorithm: 'AES-GCM-256';
  householdId: string;
  senderDeviceId: string;
  messageId: string;
  sealed: string;
}

function activeDevice(state: HouseholdPairingState, deviceId: string): boolean {
  return state.devices.some((device) => device.deviceId === deviceId && device.revokedAt === undefined);
}

const MAX_ENVELOPE_BYTES = 1024 * 1024;
const ENVELOPE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export interface OpenEnvelopeOptions<T> {
  seenMessageIds?: Set<string>;
  validate?: (value: unknown) => value is T;
}

function envelopeAad(envelope: Omit<AuthenticatedEnvelope, 'sealed'>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope));
}

export async function createAuthenticatedEnvelope(
  payload: unknown,
  keyValue: string,
  state: HouseholdPairingState,
  senderDeviceId: string,
  messageId = id(),
): Promise<AuthenticatedEnvelope> {
  if (!activeDevice(state, senderDeviceId)) throw new PairingError('device-not-authorized');
  if (!ENVELOPE_ID.test(messageId)) throw new PairingError('invalid-envelope');
  validateHouseholdKey(keyValue);
  const metadata = {
    v: 1 as const,
    algorithm: 'AES-GCM-256' as const,
    householdId: state.householdId,
    senderDeviceId,
    messageId,
  };
  const key = await AESEncryptionKey.import(keyValue, 'base64') as AESEncryptionKey;
  const serialized = JSON.stringify(payload);
  if (serialized === undefined) throw new PairingError('invalid-envelope');
  const plaintext = new TextEncoder().encode(serialized);
  if (plaintext.length > MAX_ENVELOPE_BYTES) throw new PairingError('invalid-envelope');
  const sealed = await aesEncryptAsync(plaintext, key, { additionalData: envelopeAad(metadata) });
  return { ...metadata, sealed: await sealed.combined('base64') as string };
}

export async function openAuthenticatedEnvelope<T>(
  envelope: AuthenticatedEnvelope,
  keyValue: string,
  state: HouseholdPairingState,
  options: OpenEnvelopeOptions<T> = {},
): Promise<T> {
  if (envelope.v !== 1 || envelope.algorithm !== 'AES-GCM-256' || envelope.householdId !== state.householdId) {
    throw new PairingError('wrong-household');
  }
  if (!ENVELOPE_ID.test(envelope.householdId) || !ENVELOPE_ID.test(envelope.senderDeviceId)
    || !ENVELOPE_ID.test(envelope.messageId)) throw new PairingError('invalid-envelope');
  if (options.seenMessageIds?.has(envelope.messageId)) throw new PairingError('replayed-message');
  if (!activeDevice(state, envelope.senderDeviceId)) throw new PairingError('device-not-authorized');
  validateHouseholdKey(keyValue);
  try {
    const key = await AESEncryptionKey.import(keyValue, 'base64') as AESEncryptionKey;
    const sealedBytes = base64ToBytes(envelope.sealed);
    if (sealedBytes.length < 28 || sealedBytes.length > MAX_ENVELOPE_BYTES + 28) throw new Error();
    const sealed = AESSealedData.fromCombined(sealedBytes, { ivLength: 12, tagLength: 16 });
    const plaintext = await aesDecryptAsync(sealed, key, {
      additionalData: envelopeAad({
        v: envelope.v,
        algorithm: envelope.algorithm,
        householdId: envelope.householdId,
        senderDeviceId: envelope.senderDeviceId,
        messageId: envelope.messageId,
      }),
    });
    if (plaintext.length > MAX_ENVELOPE_BYTES) throw new Error();
    const value = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
    if (options.validate && !options.validate(value)) throw new Error();
    options.seenMessageIds?.add(envelope.messageId);
    return value as T;
  } catch {
    throw new Error('Unauthenticated or tampered payload');
  }
}
