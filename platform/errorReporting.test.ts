import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

import { init } from './errorReporting';

jest.mock('@sentry/react-native', () => ({ init: jest.fn() }));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { sentryDsn: '' } },
}));

describe('errorReporting', () => {
  const expoConfigWithDsn = (sentryDsn: string) =>
    ({ extra: { sentryDsn } }) as unknown as typeof Constants.expoConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    Constants.expoConfig = expoConfigWithDsn('');
  });

  it('does not initialize Sentry while the V1 DSN is blank (#77)', () => {
    init();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry only when a DSN is explicitly configured', () => {
    Constants.expoConfig = expoConfigWithDsn('https://public@example.invalid/1');

    init();

    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://public@example.invalid/1',
    });
  });
});
