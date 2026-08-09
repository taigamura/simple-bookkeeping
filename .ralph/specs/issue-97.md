# Create a provider-neutral import pipeline

> GitHub issue #97 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/97

## Parent

#88

## What to build

Extract CSV decoding, record parsing, provider detection, normalized rows, provenance, deduplication, preview, and atomic application behind one adapter contract while preserving Zaim behavior.

## Acceptance criteria

- [ ] Provider parsers cannot construct persisted transactions directly.
- [ ] Import provenance preserves multiplicity of legitimate identical purchases while exact re-import remains idempotent.
- [ ] Unknown/ambiguous formats, transfers, currency mismatches, and unsupported fields produce explicit no-write outcomes or tallies.
- [ ] Zaim parity fixtures and atomic apply tests pass.

## Blocked by

- Blocked by #90
- Blocked by #91

