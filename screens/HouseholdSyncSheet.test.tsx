import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import type { SyncHistoryRow, SyncStatusModel } from '../domain';
import { HouseholdSyncSheet } from './HouseholdSyncSheet';

const model: SyncStatusModel = {
  status: 'offline',
  syncNow: 'partner-absent',
  queuedOperationCount: 1,
  lastSyncedAt: '2026-08-10T01:02:03.000Z',
};

const history: SyncHistoryRow[] = [{
  transactionId: 'entry-1', operationId: 'phone-a:2', change: 'edited', actorId: 'phone-a',
  transaction: { id: 'entry-1', y: 2026, m: 7, day: 10, type: 'expense', amount: 1200, category: 'Food' },
}];

function renderSheet(over: Partial<React.ComponentProps<typeof HouseholdSyncSheet>> = {}) {
  return render(
    <ThemeProvider>
      <HouseholdSyncSheet model={model} history={history} onSyncNow={() => {}} onRestore={() => {}} onClose={() => {}} {...over} />
    </ThemeProvider>,
  );
}

describe('HouseholdSyncSheet', () => {
  it('warns about the two-phone limit and exposes revocation', () => {
    const onRevokeDevice = jest.fn();
    renderSheet({
      pairing: {
        state: {
          householdId: 'home',
          devices: [{ deviceId: 'phone-a', authorizedAt: 1 }, { deviceId: 'phone-b', authorizedAt: 2 }],
          invitations: [],
        },
        deviceId: 'phone-a',
        onRevokeDevice,
      },
    });

    expect(screen.getByText(/Only two phones can be active/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Revoke: phone-b'));
    expect(onRevokeDevice).toHaveBeenCalledWith('phone-b');
  });

  it('does not offer incomplete replacement onboarding after the peer is revoked', () => {
    renderSheet({
      pairing: {
        state: {
          householdId: 'home',
          devices: [
            { deviceId: 'phone-a', authorizedAt: 1 },
            { deviceId: 'phone-b', authorizedAt: 2, revokedAt: 3 },
          ],
          invitations: [],
        },
        deviceId: 'phone-a',
        onRevokeDevice: jest.fn(),
      },
    });

    expect(screen.queryByLabelText('Invite another phone')).toBeNull();
  });

  it('shows nearby-only status, last sync, and safe sync action when the partner is absent', () => {
    const onSyncNow = jest.fn();
    renderSheet({ onSyncNow });

    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getByText('Last synced: 2026-08-10T01:02:03.000Z')).toBeTruthy();
    expect(screen.getByText('Partner not nearby. Nothing will change on this phone.')).toBeTruthy();
    expect(screen.getByText('If both phones are lost, recovery is impossible without a surviving phone or a valid recovery pack.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Sync now'));
    expect(onSyncNow).toHaveBeenCalledTimes(1);
  });

  it('shows attributed history without rendering free-form secrets and restores a prior version', () => {
    const onRestore = jest.fn();
    renderSheet({ onRestore });

    expect(screen.getByText('Edited')).toBeTruthy();
    expect(screen.getByText('By phone-a')).toBeTruthy();
    expect(screen.queryByText(/private/)).toBeNull();
    fireEvent.press(screen.getByLabelText('Restore version: Edited'));
    expect(onRestore).toHaveBeenCalledWith('entry-1', 'phone-a:2');
  });
});
