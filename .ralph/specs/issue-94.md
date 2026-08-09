# Show the current-month today allowance

> GitHub issue #94 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/94

## Parent

#88

## What to build

Compute and present 「今日使えるお金」 from the shared budget model as a decision-grade current-month value, using the same pure payload that later widgets and Watch surfaces consume.

## Acceptance criteria

- [ ] Remaining configured budget is divided by remaining calendar days including today, conservatively rounded to integer units.
- [ ] Expenses through today count, income and future-dated occurrences do not; no-budget and overspent states are explicit.
- [ ] The Calendar current month shows TODAY while browsed non-current months preserve month-budget context.
- [ ] Leap/month-end/time-zone, no-budget, overspent, total-budget, and category-budget tests pass.

## Blocked by

- Blocked by #90

