# Import verified MoneyForward transaction exports

> GitHub issue #111 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/111

## Parent

#88

## What to build

Add a strict MoneyForward adapter to the normalized import pipeline using only the verified contract and fixtures, with on-device detection, safe tallies, provenance, and idempotent re-import.

## Acceptance criteria

- [ ] Supported verified rows import once with category/date/type/amount preserved.
- [ ] Transfers, mismatched currency, malformed and unsupported rows are skipped explicitly.
- [ ] Repeated identical purchases retain multiplicity while exact file re-import is idempotent.
- [ ] Encoding/header variants and mixed-row fixture tests pass.

## Blocked by

- Blocked by #97
- Blocked by #109

