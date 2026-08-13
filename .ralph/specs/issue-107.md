# Export and restore an encrypted household recovery pack

> GitHub issue #107 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/107

## Parent

#88

## What to build

Provide optional offline recovery for both-phone loss through a device-authenticated, passphrase-protected household pack containing the key and sync state needed for restoration.

## Acceptance criteria

- [ ] Export requires device authentication and a user passphrase that Kaji never stores or transmits.
- [ ] Wrong passphrase, tampering, unsupported version, cancellation, and partial files never modify live state.
- [ ] Successful restore validates into staging, preserves a rollback checkpoint, and recreates one two-device household slot.
- [ ] The UI states honestly that recovery is impossible without a surviving phone or valid pack.

## Blocked by

- Blocked by #104

