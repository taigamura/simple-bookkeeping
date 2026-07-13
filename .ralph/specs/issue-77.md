# Freeze V1 privacy mode and remove monetization remnants

> GitHub issue #77 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/77

## Parent

#72

## What to build

Freeze a verifiable zero-data-collection V1 mode from persisted state through release configuration and public privacy claims. Remove the unused Premium/ad remnants, ensure old persisted Premium data remains harmless, keep crash reporting and telemetry disabled, and verify that the production candidate's configuration and runtime behavior support the bilingual “Data Not Collected” promise.

## Acceptance criteria

- [ ] Unused Premium state and dead sponsored/ad components are removed without breaking loads of older persisted envelopes that contain the legacy field.
- [ ] No user-visible purchase, Premium, sponsored, advertising, analytics, account, or sync surface remains in the app or first-launch experience.
- [ ] The Sentry DSN remains blank, source-map upload remains disabled for V1 builds, and no analytics or telemetry SDK is enabled at runtime.
- [ ] A documented production-build/network audit finds no unexpected data transmission during the core user journey.
- [ ] English and Japanese privacy policy text, App Store privacy answers, and release documentation describe the verified binary consistently, including operating-system-managed biometric authentication.

## Blocked by

None - can start immediately

