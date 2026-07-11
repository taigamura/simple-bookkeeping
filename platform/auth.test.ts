/**
 * auth module tests (#55): passcode-or-better availability. Mock
 * expo-local-authentication to test SecurityLevel transitions without
 * touching native code.
 */
jest.mock('expo-local-authentication');

import * as LocalAuthentication from 'expo-local-authentication';
import * as auth from './auth';

const mockGetEnrolledLevelAsync = LocalAuthentication.getEnrolledLevelAsync as jest.Mock;
const mockIsEnrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;
const mockHasHardware = LocalAuthentication.hasHardwareAsync as jest.Mock;

describe('auth.isAuthAvailable()', () => {
  beforeEach(() => {
    mockGetEnrolledLevelAsync.mockReset();
    mockIsEnrolled.mockReset();
    mockHasHardware.mockReset();
  });

  it('returns true when biometrics are enrolled (BIOMETRIC level)', async () => {
    mockGetEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC);

    const available = await auth.isAuthAvailable();

    expect(available).toBe(true);
  });

  it('returns true when only passcode is enrolled (SECRET level)', async () => {
    mockGetEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);

    const available = await auth.isAuthAvailable();

    expect(available).toBe(true);
  });

  it('returns false when nothing is enrolled (NONE level)', async () => {
    mockGetEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);

    const available = await auth.isAuthAvailable();

    expect(available).toBe(false);
  });

  it('falls back to biometric-only check if getEnrolledLevelAsync fails', async () => {
    mockGetEnrolledLevelAsync.mockRejectedValue(new Error('Not available'));
    mockHasHardware.mockResolvedValue(true);
    mockIsEnrolled.mockResolvedValue(true);

    const available = await auth.isAuthAvailable();

    expect(available).toBe(true);
    expect(mockHasHardware).toHaveBeenCalled();
    expect(mockIsEnrolled).toHaveBeenCalled();
  });
});
