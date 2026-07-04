/**
 * LockGate tests (#30): the wrapper (`platform/auth`) is faked so these never
 * touch expo-local-authentication (which has no jest-mockable native module —
 * see platform/auth.ts's header comment). Covers gated/ungated and the
 * failed-attempt retry path.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import * as auth from '../platform/auth';
import { ThemeProvider } from '../theme';
import { LockGate } from './LockGate';

jest.mock('../platform/auth');
const mockAuthenticate = auth.authenticate as jest.Mock;

const Children = () => <Text>Secret ledger</Text>;

const renderGate = (enabled: boolean) =>
  render(
    <ThemeProvider>
      <LockGate enabled={enabled}>
        <Children />
      </LockGate>
    </ThemeProvider>,
  );

describe('LockGate', () => {
  beforeEach(() => {
    mockAuthenticate.mockReset();
  });

  it('renders children immediately when disabled, never calling authenticate', () => {
    renderGate(false);

    expect(screen.getByText('Secret ledger')).toBeTruthy();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('hides children behind a lock screen until authenticate succeeds when enabled', async () => {
    mockAuthenticate.mockResolvedValue(true);

    renderGate(true);

    await waitFor(() => expect(screen.getByText('Secret ledger')).toBeTruthy());
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('keeps content hidden and offers a retry when authentication fails', async () => {
    mockAuthenticate.mockResolvedValue(false);

    renderGate(true);

    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Secret ledger')).toBeNull();

    mockAuthenticate.mockResolvedValue(true);
    fireEvent.press(screen.getByLabelText('Unlock'));

    await waitFor(() => expect(screen.getByText('Secret ledger')).toBeTruthy());
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
  });
});
