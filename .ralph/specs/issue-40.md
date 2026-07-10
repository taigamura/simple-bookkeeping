# Calendar 7-column grid fix (Sunday-first, subpixel wrap)

> GitHub issue #40 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/40

## Parent

#31 — Device polish: calendar grid, bottom-edge layout, gesture sheets, entry edit/delete, month swipe

## What to build

Fix the month calendar so it always renders **7 columns, Sunday-first**, on a physical device — matching the web/PC build. This is a rendering bug, **not** a date-logic bug: the grid already computes a correct Sunday-first week with seven slots at `100/7 %` each, but seven percentage widths can round up past 100% on device and wrap the 7th cell into a new row, yielding a 6-column layout where the week appears to start on Saturday and Sunday looks skipped.

Fix by restructuring the grid into **explicit week rows**: chunk the leading-blank + day cells into rows of 7, each row a flex row of seven `flex: 1` cells. This guarantees exactly 7 per row and keeps the weekday header aligned. The underlying date math (`firstWeekday`, `daysInMonth`, Sunday-first `WEEKDAYS`) is already correct and stays unchanged.

## Acceptance criteria

- [ ] The month grid renders exactly 7 columns per week row on device and web
- [ ] Days sit under the correct Sunday-through-Saturday weekday headers
- [ ] Sunday is visible as the first column; no day appears skipped
- [ ] The weekday header row and the day cells stay aligned
- [ ] A thin structural test asserts the grid groups days into weeks of 7 (7 columns per row)
- [ ] No changes to the date-math helpers

## Blocked by

- None - can start immediately

