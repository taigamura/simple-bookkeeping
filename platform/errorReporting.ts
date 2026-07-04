/**
 * errorReporting — Sentry crash reporting (#27), the sole exception to the
 * app's "nothing leaves the device" privacy story. The DSN comes from app
 * config (`expo.extra.sentryDsn` in app.json) via expo-constants, which is
 * blank until the developer pastes a real one in later. With no DSN, `init()`
 * is a deliberate no-op *before* ever calling `Sentry.init` — not a reliance
 * on the SDK's own no-dsn handling — so there's no ambiguity about whether a
 * network call or console warning could slip out while inert.
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
