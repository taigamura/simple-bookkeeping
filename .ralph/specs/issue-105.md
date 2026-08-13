# Expose nearby sync status, history, and recovery actions

> GitHub issue #105 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/105

## Parent

#88

## What to build

Add the user-facing paired-household surface: paired/offline/syncing/error states, Last synced, Sync now, attributed change history, prior-version restore, and staged merge/rollback failure messaging.

## Acceptance criteria

- [ ] Status never implies remote/background sync and Sync now is safe when the partner is absent.
- [ ] History identifies creator/last editor and material adds/edits/deletes without exposing secrets.
- [ ] Restore creates new entities under the selected tombstone rules.
- [ ] JP/EN, accessibility, failure, rollback, and screen-state tests pass.

## Blocked by

- Blocked by #104
- Blocked by #100

