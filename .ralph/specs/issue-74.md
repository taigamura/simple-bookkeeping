# Recover safely from invalid or failed ledger persistence

> GitHub issue #74 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/74

## Parent

#72

## What to build

Make local ledger persistence fail safely from storage through the user interface. Validate and normalize the complete persisted state before it reaches the app, preserve any invalid raw blob through the existing recovery mechanism, serialize whole-state writes so the newest accepted state is always durable last, and give the user localized recovery guidance when a save cannot be completed.

## Acceptance criteria

- [ ] Loading validates every supported top-level field and nested transaction; syntactically valid but structurally invalid state is stashed and follows the existing corrupt-load notice/export path.
- [ ] Missing additive fields receive supported defaults, unknown fields are discarded, and valid older envelopes continue to load without losing ledger data.
- [ ] Whole-state saves execute in update order; a delayed earlier write cannot overwrite a newer state, proven with a controllable persistence double.
- [ ] Persistence read and write failures do not crash the app or silently claim durability; the user receives localized, non-sensitive recovery guidance.
- [ ] Existing corrupt-stash export behavior and delete-all-data semantics remain intact and are covered by store and app-level tests.

## Blocked by

None - can start immediately

