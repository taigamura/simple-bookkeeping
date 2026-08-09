# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #91
  - Spec: .ralph/specs/issue-91.md

## Learnings
- Added the provider-independent `validateFinancialRow` boundary for calendar-valid dates, positive safe integer amounts, supported transaction types, and non-empty categories.
- Zaim imports now tally invalid dates, amounts, categories, types, and out-of-range values independently, while continuing to import valid rows from mixed files.
- Import confirmation messages expose every skip tally in English and Japanese.
- Verification passed: typecheck, 441 Jest tests, web export, and 19 Playwright scenarios.
