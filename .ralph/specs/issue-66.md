# Total vs. per-category budget toggle

> GitHub issue #66 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/66

## Parent

#64

## What to build

Add a **total budget** mode alongside today's per-category budgets. The Budgets sheet gains a two-option toggle at the top: **per category** (today's behavior — one recurring amount per expense category) or **total** (a single recurring monthly amount for the whole month). In total mode the sheet shows one numeric amount field; in category mode it shows the existing per-category list.

Switching modes is **lossless** — the per-category map and the total amount are independent persisted fields, so flipping the toggle never clears either set.

All mode-awareness lives in the budgets domain module (the single logic seam) — screens must not branch on the mode themselves. Add mode-aware helpers there: an "is a budget active" predicate (`total > 0` in total mode; the existing any-category-set check in category mode) and a remaining-budget calculation (`totalBudget − month expenses` in total mode; the existing `Σ category budgets − month expenses` in category mode). Overspend goes negative in both modes, never clamped.

The Calendar BUDGET column and the Summary budget-left line appear iff a budget is active for the current mode, and show the mode-aware remaining. In total mode the Summary's per-category rows render spend only, with no per-category target (identical to how an unbudgeted category already renders) — no synthetic targets.

Schema: add `budgetMode: 'category' | 'total'` (default `'category'`) and `totalBudget: number` (default `0`, 0 = no total, positive integer otherwise) to the persisted whole-state blob. Backward-compatible via the existing merge-by-known-keys load — no schema-version bump (mirrors how `budgets` was added).

## Acceptance criteria

- [ ] Budgets sheet shows a per-category / total toggle; category mode renders the existing list, total mode renders a single amount field bound to the total
- [ ] Total field uses the same digits-only, blank-clears convention as the per-category rows
- [ ] Switching modes back and forth preserves both the per-category map and the total amount
- [ ] `budgetMode` and `totalBudget` persist and survive reload; loading an older blob without them falls back to the defaults
- [ ] Mode-aware active-predicate and remaining helpers live in the budgets domain module; Calendar and Summary consume them rather than branching on the mode
- [ ] In total mode, the Calendar BUDGET column and Summary budget-left line appear only when the total is > 0 and show `total − month expenses`; overspend shows as a true negative in red
- [ ] In total mode the Summary category rows show spend with no per-category budget target; category mode is unchanged
- [ ] Domain tests cover the active-predicate and remaining math in both modes, including the overspend (negative) case

## Blocked by

None - can start immediately

