# Calendar: tighten dead space between grid and day list

> GitHub issue #70 | Labels: ready-for-agent, P2 | https://github.com/taigamura/simple-bookkeeping/issues/70

## Parent

#64

## What to build

Tighten the vertical spacing on the Calendar between the month grid and the selected-day header/item list. Today there's an awkward band of dead space under the grid before the tapped-day list. Reduce the gap (the day header's top margin is the main offender) while keeping a modest amount of breathing room — closer, not cramped.

Style-only; verified by eye on the dev-web build. The exact value is tuned during verification.

## Acceptance criteria

- [ ] The gap between the month grid and the selected-day list is visibly reduced
- [ ] The layout keeps modest breathing room and does not feel cramped or tight
- [ ] No regression to the day header (label + net) or the day list rendering
- [ ] Verified by eye

## Blocked by

None - can start immediately

