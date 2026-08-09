# Reconcile external quick-entry commands exactly once

> GitHub issue #96 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/96

## Parent

#88

## What to build

Add a platform-neutral QuickEntryCommand contract and app-root reconciliation path so future widgets, App Intents, controls, and Watch can queue immutable entry commands without rewriting the ledger.

## Acceptance criteria

- [ ] Commands validate version, source, ID, timestamp, amount, category, note, and date.
- [ ] Boot/foreground reconciliation is idempotent and uses command identity for transaction deduplication.
- [ ] Partial/malformed commands are quarantined with recovery behavior.
- [ ] Concurrent, duplicate, killed-app, and retry tests pass through the existing store/Root seams.

## Blocked by

- Blocked by #90

