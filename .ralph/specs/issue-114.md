# Add full-fidelity local household backup and restore

> GitHub issue #114 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/114

## Parent

#88

## What to build

Complete the zero-lock-in promise with a versioned full-fidelity app backup for household data and sync metadata, while retaining portable transaction CSV as a separate lossy format.

## Acceptance criteria

- [ ] Backup round-trips transactions, recurrence, categories, budgets, currency, tombstones, attribution, and history without including device-local preferences unless explicitly documented.
- [ ] Restore stages, validates, previews, preserves rollback, and rejects corrupt/newer/cross-household data safely.
- [ ] Portable CSV remains clearly distinguished from full-fidelity backup.
- [ ] Legacy, corrupt, replay, and exact round-trip tests pass.

## Blocked by

- Blocked by #102
- Blocked by #97

