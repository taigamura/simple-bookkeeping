# Settings sheet sizing: no dead zone, full-height scroll

> GitHub issue #61 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/61

## Parent

#57 (PRD 7)

## What to build

Fix the Settings sheet's height behavior on the new single sheet host. Remove the fixed ~460 scroll cap (a #44-era decision explicitly reversed in PRD 7): the sheet opens at the height its content needs, capped at near-full-screen (respecting the top safe-area inset), and the scroll area fills the sheet exactly. The blank dead zone Build 7 showed between the last content and the sheet's bottom edge — an artifact of nesting the sheet-aware scroll view inside the dynamic-sizing content view — must be gone; sheet-aware scroll containers are used the way the library intends under the single host. Budgets gets the same treatment (it shares the scroll-container pattern).

On a tall phone Settings should show most or all sections without scrolling; on a smaller phone it scrolls a window as tall as the screen allows.

## Acceptance criteria

- [ ] No hard-coded scroll height cap remains; sheet height = content height up to near-full-screen
- [ ] No dead zone inside the sheet: the e2e geometry assertion (from #58) is tightened to the small-tolerance check and passes
- [ ] Scroll reaches every Settings section (Appearance, Lock, Currency, Categories, Budgets row, Data) on a small viewport
- [ ] Budgets sheet scroll behaves the same way
- [ ] Existing component tests for Settings/Budgets content remain green

## Blocked by

- #60

