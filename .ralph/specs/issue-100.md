# Merge transaction edits and remove-wins deletes with history

> GitHub issue #100 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/100

## Parent

#88

## What to build

Extend the replicated transaction slice so either partner can edit or delete any entry, with creator/last-editor attribution, deterministic whole-record conflict ordering, remove-wins tombstones, and recoverable prior versions.

## Acceptance criteria

- [ ] Concurrent edit/edit converges deterministically and retains the losing version in history.
- [ ] Delete beats stale or concurrent edit and cannot be resurrected by an offline replica.
- [ ] Restore creates a new transaction rather than erasing the tombstone.
- [ ] Attribution, audit, replay, rollback, and two-device convergence tests pass.

## Blocked by

- Blocked by #95

