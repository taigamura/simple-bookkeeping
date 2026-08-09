/**
 * Transport-independent household pairing primitives.
 *
 * The only value that is ever persisted by the pairing layer is an opaque
 * invitation record. Household keys belong in the platform Keychain seam (see
 * `KeychainSecretStore`), never in the app's AsyncStorage state blob.
 */

export const PAIRING_VERSION = 1;
export const DEFAULT_INVITATION_TTL_MS = 5 * 60 * 1000;
export const KEYCHAIN_SERVICE = 'kaji.household';

type CryptoLike = {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: SubtleCrypto;
};

function cryptoSource(): CryptoLike {
  const source = globalThis.crypto as Partial<CryptoLike> | undefined;
  if (!source?.getRandomValues || !source.subtle) {
    throw new Error('A platform Web Crypto implementation is required');
  }
  return source as CryptoLike;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoded secret');
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function cryptoBytes(value: Uint8Array): BufferSource {
  return value as Uint8Array<ArrayBuffer>;
}

function randomToken(bytes = 32): string {
  return bytesToBase64Url(cryptoSource().getRandomValues(new Uint8Array(bytes)));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
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

export type PairingFailure =
  | 'invalid-invitation'
  | 'expired-invitation'
  | 'invitation-used'
  | 'wrong-household'
  | 'matching-code-mismatch'
  | 'device-already-authorized'
  | 'device-revoked'
  | 'device-limit-reached';

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

function matchingCode(): string {
  const value = Number.parseInt(randomToken(4), 36) % 1_000_000;
  return value.toString().padStart(6, '0');
}

function invitationPayload(invitation: PendingInvitation, householdKey: string): string {
  return JSON.stringify({ v: PAIRING_VERSION, id: invitation.invitationId, householdId: invitation.householdId, token: invitation.token, expiresAt: invitation.expiresAt, householdKey });
}

function parseInvitation(value: string): { invitationId: string; householdId: string; token: string; expiresAt: number; householdKey: string } {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.v !== PAIRING_VERSION || typeof parsed.id !== 'string' || typeof parsed.householdId !== 'string' || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number' || typeof parsed.householdKey !== 'string') throw new Error();
    base64UrlToBytes(parsed.householdKey);
    return { invitationId: parsed.id, householdId: parsed.householdId, token: parsed.token, expiresAt: parsed.expiresAt, householdKey: parsed.householdKey };
  } catch {
    throw new PairingError('invalid-invitation');
  }
}

export function createHousehold(ownerDeviceId: string, now = Date.now()): HouseholdCreation {
  if (!ownerDeviceId) throw new Error('A device ID is required');
  return {
    state: { householdId: id(), devices: [{ deviceId: ownerDeviceId, authorizedAt: now }], invitations: [] },
    householdKey: randomToken(32),
  };
}

export function createInvitation(state: HouseholdPairingState, householdKey: string, now = Date.now(), ttlMs = DEFAULT_INVITATION_TTL_MS): InvitationCreation {
  if (state.devices.filter((device) => !device.revokedAt).length >= 2) throw new PairingError('device-limit-reached');
  if (ttlMs <= 0 || !Number.isFinite(ttlMs)) throw new Error('Invitation TTL must be positive');
  base64UrlToBytes(householdKey);
  const invitation: PendingInvitation = { invitationId: id(), householdId: state.householdId, token: randomToken(), matchingCode: matchingCode(), issuedAt: now, expiresAt: now + ttlMs };
  return { state: { ...state, invitations: [...state.invitations, invitation] }, invitation, qrPayload: invitationPayload(invitation, householdKey) };
}

export function joinHousehold(state: HouseholdPairingState, qrPayload: string, suppliedMatchingCode: string, deviceId: string, now = Date.now()): JoinResult {
  const parsed = parseInvitation(qrPayload);
  if (parsed.householdId !== state.householdId) throw new PairingError('wrong-household');
  const invitation = state.invitations.find((candidate) => candidate.invitationId === parsed.invitationId && constantTimeEqual(candidate.token, parsed.token));
  if (!invitation) throw new PairingError('invalid-invitation');
  if (invitation.usedAt !== undefined) throw new PairingError('invitation-used');
  if (now >= invitation.expiresAt || parsed.expiresAt !== invitation.expiresAt) throw new PairingError('expired-invitation');
  if (!constantTimeEqual(invitation.matchingCode, suppliedMatchingCode)) throw new PairingError('matching-code-mismatch');
  const existing = state.devices.find((device) => device.deviceId === deviceId);
  if (existing?.revokedAt) throw new PairingError('device-revoked');
  if (existing) throw new PairingError('device-already-authorized');
  if (state.devices.filter((device) => !device.revokedAt).length >= 2) throw new PairingError('device-limit-reached');
  return {
    state: {
      ...state,
      devices: [...state.devices, { deviceId, authorizedAt: now }],
      invitations: state.invitations.map((candidate) => candidate.invitationId === invitation.invitationId ? { ...candidate, usedAt: now } : candidate),
    },
    householdKey: parsed.householdKey,
    invitationId: invitation.invitationId,
  };
}

export function revokeDevice(state: HouseholdPairingState, deviceId: string, now = Date.now()): HouseholdPairingState {
  if (!state.devices.some((device) => device.deviceId === deviceId)) throw new PairingError('invalid-invitation');
  return { ...state, devices: state.devices.map((device) => device.deviceId === deviceId ? { ...device, revokedAt: now } : device) };
}

export interface KeychainSecretStore {
  get(service: string, account: string): Promise<string | null>;
  set(service: string, account: string, secret: string): Promise<void>;
  delete(service: string, account: string): Promise<void>;
}

export function householdKeyAccount(householdId: string): string {
  return `household:${householdId}`;
}

export async function storeHouseholdKey(keychain: KeychainSecretStore, householdId: string, householdKey: string): Promise<void> {
  base64UrlToBytes(householdKey);
  await keychain.set(KEYCHAIN_SERVICE, householdKeyAccount(householdId), householdKey);
}

export async function loadHouseholdKey(keychain: KeychainSecretStore, householdId: string): Promise<string | null> {
  return keychain.get(KEYCHAIN_SERVICE, householdKeyAccount(householdId));
}

export async function deleteHouseholdKey(keychain: KeychainSecretStore, householdId: string): Promise<void> {
  await keychain.delete(KEYCHAIN_SERVICE, householdKeyAccount(householdId));
}

export interface AuthenticatedEnvelope {
  v: 1;
  algorithm: 'AES-GCM-256';
  nonce: string;
  ciphertext: string;
  aad?: string;
}

export async function createAuthenticatedEnvelope(payload: unknown, householdKey: string, aad?: string): Promise<AuthenticatedEnvelope> {
  const keyBytes = base64UrlToBytes(householdKey);
  if (keyBytes.length !== 32) throw new Error('Household key must be 256 bits');
  const crypto = cryptoSource();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', cryptoBytes(keyBytes), 'AES-GCM', false, ['encrypt']);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad ? new TextEncoder().encode(aad) : undefined }, key, plaintext);
  return { v: 1, algorithm: 'AES-GCM-256', nonce: bytesToBase64Url(nonce), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)), ...(aad ? { aad } : {}) };
}

export async function openAuthenticatedEnvelope<T>(envelope: AuthenticatedEnvelope, householdKey: string): Promise<T> {
  if (envelope.v !== 1 || envelope.algorithm !== 'AES-GCM-256' || typeof envelope.aad !== 'string' && envelope.aad !== undefined) throw new Error('Invalid authenticated envelope');
  const keyBytes = base64UrlToBytes(householdKey);
  if (keyBytes.length !== 32) throw new Error('Household key must be 256 bits');
  try {
    const crypto = cryptoSource();
    const key = await crypto.subtle.importKey('raw', cryptoBytes(keyBytes), 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: cryptoBytes(base64UrlToBytes(envelope.nonce)), additionalData: envelope.aad ? cryptoBytes(new TextEncoder().encode(envelope.aad)) : undefined }, key, cryptoBytes(base64UrlToBytes(envelope.ciphertext)));
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    throw new Error('Unauthenticated or tampered payload');
  }
}
