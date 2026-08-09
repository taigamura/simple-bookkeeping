# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #92
  - Spec: .ralph/specs/issue-92.md

## Learnings
- EntrySheet dates now cross a platform boundary: iOS uses a temporary spinner with Cancel, Today, and Done; Android uses the system date dialog; web uses a constrained date input.
- Date conversion is local-calendar based and bounded to years 1–9999, preserving leap days and save payloads for create, edit, projected occurrence, and repeat management flows.
- Verification passed: typecheck, 445 Jest tests, web export, and 19 Playwright scenarios (one initial backdrop-dismiss timing flake passed on focused rerun).
