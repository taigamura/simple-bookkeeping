# Migrate ledger entities to stable household identities

> GitHub issue #90 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/90

## Parent

#88

## What to build

Introduce a backward-compatible persisted schema whose transactions, recurrence rules, categories, and budget references use stable cross-device identities while preserving all existing user-visible behavior and local category ordering.

## Acceptance criteria

- [ ] Existing envelopes migrate exactly once without losing entries, recurrence, categories, budgets, currency, or preferences.
- [ ] New entities use cryptographically strong stable IDs and category references no longer depend on mutable labels.
- [ ] Household-shareable state is separated from device-local appearance/navigation/motion/order state.
- [ ] Migration, corrupt-state, and legacy compatibility tests pass.

## Blocked by

None - can start immediately

