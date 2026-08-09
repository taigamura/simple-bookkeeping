# Synchronize automatically over foreground nearby P2P

> GitHub issue #104 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/104

## Parent

#88

## What to build

Connect the deterministic household protocol to an iOS MultipeerConnectivity boundary that discovers and synchronizes authenticated paired phones automatically only while both apps are foregrounded and nearby.

## Acceptance criteria

- [ ] Discovery advertises no financial metadata and accepts only the paired household identity.
- [ ] Local operations queue while absent and exchange idempotently on launch/foreground availability.
- [ ] The app makes no background or remote-sync promise and exposes transport failure without data loss.
- [ ] Native config/permission generation and transport-double tests pass; real-device certification remains gated.

## Blocked by

- Blocked by #102
- Blocked by #103

