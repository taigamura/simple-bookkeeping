# Make CSV export/import a verified backup flow

> GitHub issue #75 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/75

## Parent

#72

## What to build

Turn the existing Zaim-compatible CSV path into a verified backup and restore journey. An app-generated export must restore an empty ledger without losing supported transaction information or creating duplicates, while document-read, decode, parse, write, and share failures produce localized recoverable outcomes and never partially modify the ledger.

## Acceptance criteria

- [ ] Exporting a representative ledger and importing it into an empty state restores every supported transaction exactly once, including Japanese text, quoted fields, commas, and notes.
- [ ] Re-importing the same export adds no duplicate transactions and reports the duplicate tally through the existing import summary.
- [ ] UTF-8 and Shift-JIS Zaim imports retain their current supported behavior, including skip tallies for transfers, balance adjustments, malformed rows, and duplicates.
- [ ] Picker cancellation performs no write and displays no error; file-read, decode, parse, file-write, and share failures preserve the prior ledger and show localized recovery guidance.
- [ ] Pure CSV round-trip tests and app-level import/export orchestration tests cover success, cancellation, failure, and duplicate paths.

## Blocked by

None - can start immediately

