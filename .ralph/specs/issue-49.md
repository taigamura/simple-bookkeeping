# Budgets end-to-end: domain model, persistence, drill-in Budgets sheet

> GitHub issue #49 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/49

## Parent

#46 (Build #5 PRD) — workstream 3, slice 1 of 3.

## What to build

The budget data path end-to-end: a recurring monthly budget per expense category, settable from a new Budgets sheet reached from Settings, persisted with the rest of the app state. Demoable on its own: open Settings → Budgets, set an amount, restart the app, it's still there. (Display on Calendar/Summary lands in the follow-up slices.)

- **Model:** one recurring amount per expense category — applies to every month until changed; no per-specific-month values. A map from category name to positive amount in the persisted app state; absent = no budget. Adding the field is backward-compatible with the store's merge-by-known-keys load — no schema version bump. Income categories never have budgets.
- **Domain:** pure functions for setting/clearing a budget and the any-budget-set predicate; deleting an expense category silently drops its budget entry.
- **Budgets sheet:** a new sheet opened from a new row in the Settings sheet, drill-in style — Settings dismisses, Budgets presents, and the Budgets sheet's Done returns to Settings (the nav sheet enum gains a value; sheets never stack). Body = the expense-category list with a numeric amount field per row; blank clears the budget. Amounts display with the chosen currency symbol.
- All new user-facing strings go through the existing i18n strings module in every supported locale.

## Acceptance criteria

- [ ] Settings sheet has a Budgets row that drills into the Budgets sheet; Done on the Budgets sheet returns to Settings.
- [ ] Every expense category is listed with a numeric amount field; setting an amount stores a budget, blanking it clears the budget.
- [ ] Budgets persist across app restarts.
- [ ] Deleting an expense category from Settings drops its budget entry.
- [ ] Loading pre-existing persisted state (without the budgets field) works unchanged — defaults to no budgets.
- [ ] Domain functions unit-tested at the domain seam (prior art: existing summary/calendar domain suites).
- [ ] Store default + merge covered in the existing store suite.
- [ ] Budgets sheet tested standalone with props/callbacks (prior art: the Settings sheet tests, including the ScrollContainer default).
- [ ] New strings present in all supported locales.

## Blocked by

- #47 — builds on the stabilized sheet layer and extends the sheet navigation.

