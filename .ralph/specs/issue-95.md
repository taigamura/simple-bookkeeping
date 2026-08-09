# Converge newly added transactions across two replicas

> GitHub issue #95 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/95

## Parent

#88

## What to build

Create the first complete sync tracer bullet: local transaction creation emits an attributed operation, two in-memory household replicas exchange reordered/duplicated operations, and both converge without duplicate financial entries.

## Acceptance criteria

- [ ] Actor, household, operation, sequence, and version-vector contracts are validated.
- [ ] Add operations are replay-safe, order-independent, and use stable transaction identity.
- [ ] State plus sync metadata commit atomically and malformed/cross-household operations never reach live state.
- [ ] Two-device simulation proves convergence after duplicate, delayed, and reordered delivery.

## Blocked by

- Blocked by #90

