# Move save confirmation to a fullscreen app-canvas wave

> GitHub issue #99 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/99

## Parent

#88

## What to build

Move save confirmation from EntrySheet clipping into the app-shell overlay so it covers the visual canvas, survives sheet unmount, begins after a truthful commit/scope choice, and preserves reduced motion.

## Acceptance criteria

- [ ] Create and edit saves animate only after persistence succeeds; recurrence edits wait for scope confirmation.
- [ ] The overlay covers the app canvas, ignores pointer input, and does not claim OS-owned status/home-indicator regions.
- [ ] Artificial pre-save delay is removed and landing pulse timing is coordinated.
- [ ] Motion/Entry sizing ADRs are amended and focused timing/reduced-motion tests pass.

## Blocked by

- Blocked by #98

