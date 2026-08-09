# Synchronize unordered categories, budgets, and household currency

> GitHub issue #101 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/101

## Parent

#88

## What to build

Replicate the selected shared configuration while preserving device-local category ordering and presentation preferences.

## Acceptance criteria

- [ ] Concurrent category additions union; rename uses deterministic last-writer-wins; deletion wins while historical entries retain recorded labels.
- [ ] Total and each category budget merge independently.
- [ ] Currency is one household value with recoverable prior values.
- [ ] Appearance, navigation, motion, and category order remain local in convergence tests.

## Blocked by

- Blocked by #100

