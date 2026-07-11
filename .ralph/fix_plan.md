# Ralph Fix Plan

Build 6 sheet-reliability pass (PRD #52). Build 5 iOS testing surfaced a cluster of sheet and
Lock bugs: sheets that only open after retries, an unwanted grow gesture, an intermittent Done
button, unreachable Settings/Budgets content, a Lock that traps users, and Face ID never being
offered. Keep `@gorhom/bottom-sheet` and simplify its configuration — do not replace the library.
Each item is a GitHub issue; read the full issue body (`gh issue view <N>`) for acceptance
criteria before starting.

**Definition of done (every item):** `npm run typecheck` and `npm test` both green; every
acceptance criterion in the issue either satisfied or explicitly device-only (physical-iPhone
checks belong to the human Build 6 TestFlight pass — note them in the commit message, do not fake
them with jsdom). Exactly one commit per item, referencing the issue number. If an item cannot be
finished cleanly, revert the working tree to the last green commit and report BLOCKED with what
stopped you.

## High Priority

- [x] Sheet-swap dismissal guard (#53)
  - Done in cf6cbae: Entry sheet now uses sheetDismissed('entry'), Settings onClose
    uses sheetDismissed('settings'). Root-seam tests verify all three switch sequences.
    Playwright tests added (manual run pending).

- [x] Sheet gesture simplification (#54)
  - Done in 434e4fb: Removed 100% snap detent, disabled content panning, deleted
    anchorBottom prop and AnchoredContent. Single dynamic content-height detent per sheet.
    Deleted verify-sheets.js. Settings/Budgets scroll areas now work within ~460 cap.

- [x] Lock never-trap + passcode-level availability (#55)
  - Done in a689d55: getEnrolledLevelAsync() now checks security level (SECRET or BIOMETRIC).
    Toggle displays enabled state truthfully; disabled only when locked off AND unavailable.
    Auth and SettingsSheet component tests added for never-trap behaviors.

- [x] Face ID plugin registration (#56)
  - Done in e10af39: Registered expo-local-authentication config plugin in app.json
    with NSFaceIDUsageDescription permission string. iOS build now carries the key.

## Out of scope this session

- Replacing `@gorhom/bottom-sheet` or reworking sheet visual design (radius, backdrop, spring);
  no reverting sheets to RN `Modal`.
- Any detent/resizing UX beyond removing the grow detent — no new intermediate detents, and the
  ~460 scroll cap on Settings/Budgets stays.
- Lock changes beyond availability, never-trap, and the Face ID plugin config — no auto-lock
  timers, no lock-on-background.
- App manifest fields other than the #56 plugin registration (display name was deliberately
  reverted for TestFlight); `eas.json`; premium/IAP code; Zaim import/export.
- Calendar pager (#48) and budget display (#50/#51) — Build 5 raised no issues there.
- Category editor functionality changes (reordering UX, budgets-per-category edits).
- Regressing the unconditional sheet-body mounting contract (#47) — never gate sheet children on
  the open-sheet state.
- Closing or editing the GitHub issues themselves — the human tracks issue state.

## Completed

- [x] Implement GitHub issue #51
  - Spec: .ralph/specs/issue-51.md
  - Done in 1057e95: budget-left line on the net card (same budgetRemaining
    formula as the Calendar strip, hasAnyBudget-gated), spent/budget on
    budgeted category bars (red fill + amount when over, unclamped),
    categoryBreakdown annotated at the domain seam, en+ja strings.
  - Device-only: visual weight of the red bar fill → human TestFlight pass.

## Notes

- One focused change per loop; one commit; never leave the verify gate red.
- Device-only acceptance criteria (the Build 6 checklist in #52) are the maintainer's TestFlight
  pass — list them in the commit message as deferred, do not simulate them.
