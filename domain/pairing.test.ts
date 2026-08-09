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

describe('household pairing', () => {
  const now = 1_900_000_000_000;

  it('creates a one-use invitation and authorizes exactly one additional device', () => {
    const created = createHousehold('owner', now);
    const invitation = createInvitation(created.state, created.householdKey, now);
    const joined = joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 1);

    expect(joined.householdKey).toBe(created.householdKey);
    expect(joined.state.devices).toHaveLength(2);
    expect(() => joinHousehold(joined.state, invitation.qrPayload, invitation.invitation.matchingCode, 'third', now + 2)).toThrow(new PairingError('invitation-used'));
  });

  it('rejects wrong codes, expired invitations, and replay', () => {
    const created = createHousehold('owner', now);
    const invitation = createInvitation(created.state, created.householdKey, now, 10);

    expect(() => joinHousehold(invitation.state, invitation.qrPayload, '000000', 'partner', now + 1)).toThrow(new PairingError('matching-code-mismatch'));
    expect(() => joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 10)).toThrow(new PairingError('expired-invitation'));
    const joined = joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 2);
    expect(() => joinHousehold(joined.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner-2', now + 3)).toThrow(new PairingError('invitation-used'));
  });

  it('rejects a revoked device and never puts the key in the pairing state', () => {
    const created = createHousehold('owner', now);
    const invitation = createInvitation(created.state, created.householdKey, now);
    const joined = joinHousehold(invitation.state, invitation.qrPayload, invitation.invitation.matchingCode, 'partner', now + 1);
    const revoked = revokeDevice(joined.state, 'partner', now + 2);
    const next = createInvitation(revoked, created.householdKey, now + 3);

    expect(() => joinHousehold(next.state, next.qrPayload, next.invitation.matchingCode, 'partner', now + 4)).toThrow(new PairingError('device-revoked'));
    expect(JSON.stringify(revoked)).not.toContain(created.householdKey);
  });
});

describe('household keychain and authenticated envelopes', () => {
  const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
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

  it('authenticates encrypted payloads and rejects tampering or the wrong household key', async () => {
    const envelope = await createAuthenticatedEnvelope({ householdId: 'h1', operation: 'add' }, key, 'h1');
    await expect(openAuthenticatedEnvelope(envelope, key)).resolves.toEqual({ householdId: 'h1', operation: 'add' });
    await expect(openAuthenticatedEnvelope({ ...envelope, ciphertext: `${envelope.ciphertext}x` }, key)).rejects.toThrow('Unauthenticated');
    await expect(openAuthenticatedEnvelope(envelope, `B${key.slice(1)}`)).rejects.toThrow('Unauthenticated');
  });
});
