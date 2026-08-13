# Verify the current おカネレコ CSV contract

> GitHub issue #110 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/110

## Parent

#88

## What to build

Produce an evidence-backed, synthetic-fixture contract for current おカネレコ transaction exports before implementing an adapter; do not guess headers or use personal financial data.

## Acceptance criteria

- [ ] Sources/fixtures establish headers, encodings, date/amount signs, transfers, refunds, currency, stable IDs, and known variants.
- [ ] Synthetic/redacted fixtures are safe to commit and cover supported/unsupported rows.
- [ ] The report identifies what Kaji can import without fabricating semantics.
- [ ] Trademark/provider naming and export-access assumptions are documented.

## Blocked by

None - can start immediately

