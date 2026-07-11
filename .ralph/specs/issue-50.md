# Calendar strip BUDGET column: month remaining alongside In/Out/Net

> GitHub issue #50 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/50

## Parent

#46 (Build #5 PRD) — workstream 3, slice 2 of 3.

## What to build

Surface the month's remaining budget on the Calendar screen: a fourth BUDGET column in the In/Out/Net strip.

- **Formula:** BUDGET REMAINING = Σ(set category budgets) − total month expenses. All expenses count against the total, including spending in unbudgeted categories; income never enters the math. Implemented as a pure domain function.
- Hidden entirely when no budgets are set — the strip stays exactly three columns, layout unchanged, so the feature is invisible until the user opts in.
- Negative remaining is shown as-is in red — never clamped to zero.
- Amounts display with the chosen currency symbol; the new label goes through the i18n strings module in every supported locale.
- The column must participate in the strip's swipe-sync behavior from the pager rework (it updates in the same beat as the rest of the strip when months change).

## Acceptance criteria

- [ ] With at least one budget set, the strip shows In · Out · Net · Budget, where Budget = total budgets minus the displayed month's total expenses.
- [ ] With no budgets set, the strip is unchanged from today (three columns).
- [ ] Overspent months show a true negative remaining in red.
- [ ] The Budget value updates correctly when swiping between months, in the same beat as In/Out/Net.
- [ ] Remaining-budget math unit-tested at the domain seam (prior art: existing summary/calendar domain suites).
- [ ] Strip rendering (shown/hidden/negative) covered by the existing Calendar screen test pattern.
- [ ] New strings present in all supported locales.

## Blocked by

- #48 — the strip's swipe-sync animation lands there.
- #49 — the budget data model and persistence land there.

