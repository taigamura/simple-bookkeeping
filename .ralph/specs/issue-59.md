# Close-button unification: ✕ on Entry/Settings, ‹ back chevron on Budgets

> GitHub issue #59 | Labels: ready-for-agent, P2 | https://github.com/taigamura/simple-bookkeeping/issues/59

## Parent

#57 (PRD 7)

## What to build

Unify the sheet close affordances. Entry and Settings both render the shared icon-button ✕ at the top-right of their headers (Settings' "Done" text button is removed; Entry already has the ✕). Budgets is a drill-in, so it gets a ‹ back chevron (top-left) instead of "Done" — its action stays the existing return-to-Settings behavior, not a full close. Accessibility labels follow the existing i18n strings vocabulary (close vs back).

## Acceptance criteria

- [ ] Settings header shows the ✕ icon button top-right; no "Done" text button remains
- [ ] Entry header keeps the ✕ top-right (unchanged behavior)
- [ ] Budgets header shows a ‹ back affordance that returns to Settings; no "Done" remains
- [ ] Component tests assert the ✕ / ‹ render with correct accessibility labels and fire the right callbacks (prior art: existing SettingsSheet/BudgetsSheet standalone tests)
- [ ] e2e affordance assertions: ✕ closes Entry and Settings; ‹ on Budgets lands back in Settings

## Blocked by

None - can start immediately

