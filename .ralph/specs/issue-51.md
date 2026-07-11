# Summary screen budget display: remaining on the net card, spent/budget on category bars

> GitHub issue #51 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/51

## Parent

#46 (Build #5 PRD) — workstream 3, slice 3 of 3.

## What to build

Surface budgets on the Summary screen, in two places:

- **Net card:** budget remaining for the displayed month alongside net this month, using the same formula as the Calendar strip (Σ set category budgets − total month expenses). Hidden when no budgets are set.
- **Spending-by-category bars:** each bar for a budgeted category is annotated with spent versus budget (per-category remaining = that category's budget − that category's month expenses) and renders red when over budget. Unbudgeted categories render unchanged.
- Negative values shown as-is, never clamped. Amounts display with the chosen currency symbol; new labels go through the i18n strings module in every supported locale.

## Acceptance criteria

- [ ] With budgets set, the net card shows budget remaining alongside net this month; with none set, the card is unchanged from today.
- [ ] Category bars for budgeted categories show spent versus budget; the bar/amount renders red when the category is over budget.
- [ ] Bars for unbudgeted categories are unchanged.
- [ ] Values agree with the Calendar strip for the same month.
- [ ] Per-category remaining math unit-tested at the domain seam (prior art: existing summary domain suite).
- [ ] Card and bar rendering (shown/hidden/over-budget) covered by component tests following the existing screen test pattern.
- [ ] New strings present in all supported locales.

## Blocked by

- #49 — the budget data model and persistence land there.

