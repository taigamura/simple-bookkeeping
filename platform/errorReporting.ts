/**
 * errorReporting — Sentry crash reporting (#27). V1 keeps it inert: the DSN
 * comes from app config (`expo.extra.sentryDsn` in app.json), which is blank
 * for release builds. With no DSN, `init()` returns before calling
 * `Sentry.init`, so the SDK is not enabled at runtime.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

function readDsn(): string | undefined {
  const dsn = Constants.expoConfig?.extra?.sentryDsn;
  return typeof dsn === 'string' && dsn.length > 0 ? dsn : undefined;
}

/** Call once at the app entry point. No-ops when no DSN is configured. */
export function init(): void {
  const dsn = readDsn();
  if (!dsn) return;
  Sentry.init({ dsn });
}
