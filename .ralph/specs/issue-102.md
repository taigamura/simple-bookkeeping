# Synchronize recurrence rules, exceptions, and deterministic splits

> GitHub issue #102 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/102

## Parent

#88

## What to build

Make recurrence a convergent household entity with stable occurrence identity, shared single-occurrence exceptions, deterministic this-and-future splits, whole-rule conflict ordering, and remove-wins deletion.

## Acceptance criteria

- [ ] Both replicas materializing the same rule/date produce one occurrence identity.
- [ ] This-occurrence and this-and-future edits converge after reordered delivery.
- [ ] Concurrent rule edits resolve deterministically with losing versions recoverable.
- [ ] Rule deletion prevents stale resurrection and recurrence simulation tests pass.

## Blocked by

- Blocked by #100
- Blocked by #101

