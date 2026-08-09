# Replace EntrySheet date text with a temporary native picker

> GitHub issue #92 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/92

## Parent

#88

## What to build

Replace free-form EntrySheet date editing with a platform date-selection boundary: a temporary iOS wheel with Cancel, Today, and Done, the native Android dialog, and a safe web fallback.

## Acceptance criteria

- [ ] Create, ordinary edit, projected recurrence edit, and repeat edit preserve correct date defaults and save payloads.
- [ ] The wheel is temporary and does not permanently consume keypad space.
- [ ] Leap-day, locale, cancellation, Today, and invalid-boundary behavior is tested.
- [ ] JP/EN accessibility labels and relevant existing EntrySheet tests pass.

## Blocked by

None - can start immediately

