# Single sheet host: open reliability + Budgets root fix

> GitHub issue #60 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/60

## Parent

#57 (PRD 7)

## What to build

Replace the three side-by-side bottom-sheet modals with ONE host owned by the nav root. The root's existing `sheet` nav state (`entry` / `settings` / `budgets` / null) selects which body the host renders. Transitions between two non-null values are content swaps inside the already-presented sheet (with an animated height change); present/dismiss only happen on null→sheet and sheet→null. The dismiss-vs-present race that #47/#53/#54 patched around ceases to exist structurally, which also fixes the deterministic Budgets-never-appears bug.

Sizing becomes deterministic: content height still drives the resting detent, but a hard minimum height floor (well above zero) guarantees a failed/zero measurement can never present an invisible sheet. Maximum height is near-full-screen via the top safe-area inset.

Reconciliation: nav state is authoritative. If the host reports dismissal while nav state still points at an open sheet and the dismissal was not user-initiated, the divergence is resolved (re-present or clear) — the "state says open, modal says closed, re-taps are silent no-ops" dead state becomes impossible. Icon handlers must never depend on a state change to re-fire presentation.

Carry-over lessons: keep-editing-through-dismiss survives (edit-mode entry state persists across dismissal), and the host's body is mounted by present time.

This slice flips the expected-to-fail markers in the red-first e2e suite (#58) — the previously-red reliability scenarios passing plain is the demo.

Written-in fallback (decided in the PRD, not to be re-litigated): if a ghost/invisible present survives on device after this restructure, `@gorhom/bottom-sheet` is replaced with a plain RN `Modal` slide-up.

## Acceptance criteria

- [ ] Exactly one bottom-sheet modal instance exists app-wide; entry/settings/budgets render as its content
- [ ] Settings⇄Budgets and Entry⇄Settings transitions are content swaps with no dismiss/present pair
- [ ] A hard minimum height floor makes a zero-measurement present visibly non-invisible
- [ ] Spurious dismissals reconcile against nav state; a sheet can never be dead to re-taps of its own icon
- [ ] All `test.fail()` markers on the #58 reliability scenarios are removed and the suite passes green in CI
- [ ] Nav-root component tests (gorhom-mock seam, prior art #47/#53 tests) cover host content selection, swap coherence, budgets-back, and spurious-dismiss reconciliation
- [ ] Edit-mode entry state still survives dismissal (existing keep-editing tests stay green)

## Blocked by

- #58

