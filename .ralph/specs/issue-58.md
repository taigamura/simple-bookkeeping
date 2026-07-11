# Red-first sheet regression suite + first CI (Playwright e2e, GitHub Actions)

> GitHub issue #58 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/58

## Parent

#57 (PRD 7)

## What to build

The repo's first persistent regression pipeline, built BEFORE the sheet fix so it demonstrably reproduces the Build 7 bugs. A checked-in Playwright e2e suite drives the real Expo web build the way the user does — fresh cold page loads, real first taps — plus the repo's first CI workflow (GitHub Actions) running typecheck, the jest unit suite, and the e2e suite on every push to main and on PRs.

Scenarios:

1. Cold load → first tap on ＋ → Entry sheet visibly present. Repeated across many fresh page loads (the failure is probabilistic and worst on cold start).
2. Cold load → first tap on the gear → Settings sheet visibly present (same repetition).
3. Settings → tap the Budgets row → Budgets sheet visibly present, 10/10.
4. Open → dismiss (backdrop and close button) → immediately reopen → sheet present; covers both sheets and the swap sequences (entry→settings, settings→entry, settings⇄budgets).
5. Ghost-overlay assertion: after every dismissal and after any failed open, a tap on a calendar day must register — no invisible tap-eating layer.
6. Sheet-geometry sanity: the sheet's content fills the sheet, no dead zone beyond a small tolerance below the last content.

Red-first mechanics: scenarios that reproduce current bugs are marked expected-to-fail (Playwright's `test.fail()`), so the suite proves it catches the real failures while CI still lands green. The single-sheet-host slice flips those markers to plain passing tests. A scenario that passes against current main must be re-examined — it is not testing the real bug.

No paid services: no EAS Workflows, no Maestro, no device cloud. Web only.

## Acceptance criteria

- [ ] Playwright suite is checked in as a permanent fixture (not a throwaway driver) and runs against the Expo web build locally with a single npm script
- [ ] Reliability scenarios (cold-load first-tap opens, Budgets open, reopen-after-dismiss/swaps, ghost overlay) reproduce the Build 7 failures against current main and are marked expected-to-fail with `test.fail()`
- [ ] Geometry and any currently-passing scenarios run as normal (non-marked) tests
- [ ] GitHub Actions workflow runs typecheck, jest, and the Playwright suite on push to main and on PRs, and is green on the landed state
- [ ] README or workflow comments state the red-first contract: removing/skipping these tests is treated like deleting the unit suite

## Blocked by

None - can start immediately

