# Delete all data action in Settings

> GitHub issue #67 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/67

## Parent

#64

## What to build

A **Delete all data** action in Settings. A red-text row at the bottom of the Data section (below Import from Zaim), styled like the existing unreadable-backup recovery row. Tapping it shows a single **destructive** confirmation (reuse the existing confirm helper, which already has the web `window.confirm` fallback). On confirm, wipe the ledger and all budgets: `entries → []`, `budgets → {}`, `totalBudget → 0`.

Everything else is preserved — expense/income categories, currency, theme, app-lock, and the open-to preference are all untouched. This is "delete my transactions," not a factory reset. The corrupt-stash recovery blob is not touched, and there is no undo.

## Acceptance criteria

- [ ] A red "Delete all data" row sits at the bottom of the Settings Data section, below Import from Zaim
- [ ] Tapping it shows a single destructive confirmation; cancelling writes nothing
- [ ] Confirming clears entries, per-category budgets, and the total budget
- [ ] Categories, currency, theme, app-lock, and the open-to preference are all preserved
- [ ] The confirmation appears and works on the web build (not a silent no-op)
- [ ] The corrupt-stash blob is left intact
- [ ] The row fires its callback in the Settings sheet component test; the nav host applies the correct wipe

## Blocked by

- #66 (needs the `totalBudget` field to exist so it can be cleared)

