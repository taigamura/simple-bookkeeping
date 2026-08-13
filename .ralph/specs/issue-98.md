# Dismiss EntrySheet from safe downward drags

> GitHub issue #98 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/98

## Parent

#88

## What to build

Allow create/edit/repeat EntrySheet modes to dismiss from meaningful downward drags beginning on the top band or non-interactive blank surfaces, without stealing input or scroll gestures.

## Acceptance criteria

- [ ] Keypad keys, chips, date picker, note field, Save/Delete, recurrence controls, and other buttons never initiate dismissal.
- [ ] Scrollable content can dismiss only at offset zero; upward/horizontal/small movement does not close.
- [ ] Controlled dismiss/reopen lifecycle and ghost-overlay protections remain intact.
- [ ] Native-oriented component coverage and canonical Playwright dismissal tests pass.

## Blocked by

- Blocked by #93

