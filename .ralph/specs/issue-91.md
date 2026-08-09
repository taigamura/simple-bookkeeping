# Reject unsafe imported financial rows before persistence

> GitHub issue #91 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/91

## Parent

#88

## What to build

Close the current import safety gap by applying one canonical financial-row validator before any provider parser can mutate the ledger.

## Acceptance criteria

- [ ] Impossible dates, fractional/non-finite/unsafe amounts, empty categories, unsupported types, and out-of-range values are rejected with explicit tallies.
- [ ] One invalid row cannot poison the saved envelope or discard valid rows.
- [ ] Existing valid Zaim UTF-8 and Shift-JIS imports retain parity.
- [ ] Regression tests cover leap days, invalid month days, fractions, overflow, and mixed valid/invalid files.

## Blocked by

None - can start immediately

