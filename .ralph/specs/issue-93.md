# Escalate EntrySheet to fullscreen before scrolling

> GitHub issue #93 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/93

## Parent

#88

## What to build

Make EntrySheet use normal fit, existing compact accessibility floors, true fullscreen, and only then scrolling, while keeping Save and Delete pinned and reachable.

## Acceptance criteria

- [ ] Ordinary supported phones show the complete entry interaction without body scrolling.
- [ ] Short screens, large text, keyboard, edit/delete, and recurrence variants use fullscreen before scrolling.
- [ ] Settings and Budgets sheet geometry is unchanged.
- [ ] Component and canonical Playwright geometry/reopen tests pass without weakened assertions.

## Blocked by

None - can start immediately

