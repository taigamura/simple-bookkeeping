# Pair exactly two household phones with authenticated keys

> GitHub issue #103 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/103

## Parent

#88

## What to build

Implement the secure household lifecycle independent of transport: create household, expiring one-use QR invitation, matching-code verification, Keychain-held household key, two-active-device authorization, and authenticated payload envelopes.

## Acceptance criteria

- [ ] A second phone can join only through an unexpired one-use invitation and matching-code confirmation.
- [ ] Household secrets are never stored in ordinary AsyncStorage or exposed in logs.
- [ ] Third-device, replayed invitation, wrong household, tampered payload, and revoked-device attempts fail safely.
- [ ] Pairing state and crypto-envelope tests pass without real financial fixtures.

## Blocked by

- Blocked by #95

