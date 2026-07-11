# Calendar pager rework: native paged month list with synced header/strip/day-list

> GitHub issue #48 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/48

## Parent

#46 (Build #5 PRD) — workstream 2.

## What to build

Replace the custom reanimated/gesture-handler MonthPager with a native-driven horizontal paged list (horizontal FlatList with paging enabled), so snapping, momentum, and rapid successive flings are handled by the native scroll view — exactly the behaviors currently broken (five fast flings advance only 1–2 months; the settle flashes).

- Window the month data (render a window of months, extend it as the user nears an edge) and commit the month cursor when scroll momentum ends. No re-render hitches mid-scroll.
- The month title, In/Out/Net strip, and selected-day list must follow the swipe: either animate with the scroll (e.g. crossfade driven by scroll offset) or swap exactly at snap-end — never mid-animation. Add animation if an instant swap cannot be made to land exactly at the settle.
- One fling = exactly one month; no momentum multi-page (by design, per the PRD).
- This deletes the calendar's custom pan gesture, which is the suspected cause of the "Settings sheet stops opening after swiping months" bug — verify that symptom here, and root-cause it only if it survives.

## Acceptance criteria

- [ ] Five rapid flings advance exactly five months (verified on a physical iPhone).
- [ ] A swipe reads as one continuous motion: the grid glides to the neighbour month with no end-of-animation flash or jump.
- [ ] The month title, In/Out/Net strip, and day list transition in the same beat as the grid — the screen never snaps into place piecewise.
- [ ] Day-list vertical scrolling still works alongside horizontal month swipes.
- [ ] The header's ‹ › month buttons still work and stay in sync with swipes.
- [ ] Swipe several months away and back → both the Entry and Settings sheets still open.
- [ ] The pager's static-render/page-commit contract stays covered by a jsdom test (prior art: the existing MonthPager test).

## Blocked by

None - can start immediately

