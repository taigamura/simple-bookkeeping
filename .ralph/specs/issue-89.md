# Enforce the no-internet boundary and remove dormant telemetry

> GitHub issue #89 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/89

## Parent

#88

## What to build

Turn the selected privacy posture into an executable product invariant: remove dormant Sentry runtime/package/config surfaces, statically reject unapproved internet clients and APIs, explicitly allow only the named nearby transport boundary, and document the technical contract without claiming that all networking is absent.

## Acceptance criteria

- [ ] Runtime dependencies, configuration, and initialization contain no dormant analytics/crash-reporting path.
- [ ] CI fails on forbidden internet-capable imports/config and permits only an explicit nearby-transport allowlist.
- [ ] Internal privacy documentation says no internet/backend/accounts and distinguishes authenticated nearby traffic.
- [ ] Existing typecheck, Jest, export, and relevant CI tests pass.

## Blocked by

None - can start immediately

