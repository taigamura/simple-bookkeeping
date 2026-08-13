# Revoke a lost phone and pair its replacement

> GitHub issue #106 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/106

## Parent

#88

## What to build

Support the selected exactly-two-device lifecycle by letting a surviving phone revoke the absent peer and issue a fresh replacement invitation without creating a third active replica.

## Acceptance criteria

- [ ] Revoked credentials cannot reconnect or contribute queued operations.
- [ ] Replacement pairing transfers the convergent household safely and preserves history.
- [ ] The UI warns clearly about revocation and two-device limits.
- [ ] Revoke/replay/replacement simulations and localized accessibility tests pass.

## Blocked by

- Blocked by #104

