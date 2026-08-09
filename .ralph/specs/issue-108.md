# Create the App Group inbox and native extension bridge

> GitHub issue #108 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/108

## Parent

#88

## What to build

Using the permanent technical identifier namespace, scaffold the App Group, immutable file inbox, read-only category/currency/default snapshot, native bridge, deep-link queue, and generated entitlement/extension configuration needed by iOS quick-entry surfaces.

## Acceptance criteria

- [ ] Extension processes atomically write one unique command file and never rewrite the AsyncStorage ledger.
- [ ] The app lists, validates, acknowledges, and quarantines inbox files idempotently.
- [ ] `com.taigamura.kaji` identifiers are stable while public display naming remains blocked.
- [ ] Generated config, entitlement, partial-write, deep-link-after-hydration, and snapshot tests pass.

## Blocked by

- Blocked by #96

