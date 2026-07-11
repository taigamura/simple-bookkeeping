# Grab bar: handle drag tracks the finger and dismisses on iOS

> GitHub issue #62 | Labels: ready-for-agent, P1 | https://github.com/taigamura/simple-bookkeeping/issues/62

## Parent

#57 (PRD 7)

## What to build

Build 7 on device: dragging the sheet's grab handle produces no movement at all — the handle's pan gesture receives no touches. Diagnose why (suspect the gesture-handler / reanimated / new-architecture interaction in the current dependency set) and fix it so the sheet visibly tracks the finger during a handle drag and a downward fling dismisses. Backdrop-tap dismissal must keep working alongside.

Diagnosis-first: confirm the actual failing layer before changing config. If the handle gesture proves unfixable within `@gorhom/bottom-sheet`, this feeds the PRD's written-in fallback (replace gorhom with a plain RN `Modal` slide-up) rather than another patch attempt.

Verification is primarily the Build 8 device checklist (web cannot judge native gesture feel); add whatever automated coverage the diagnosis makes possible at existing seams.

## Acceptance criteria

- [ ] Root cause of the dead handle pan gesture is identified and written up in the issue
- [ ] On a physical iPhone: handle drag visibly tracks the finger; downward fling dismisses the sheet
- [ ] Backdrop tap still dismisses
- [ ] If unfixable within gorhom: the RN Modal fallback decision is surfaced to the maintainer instead of a workaround patch
- [ ] Any newly-testable behavior gets coverage at existing seams (nav-root or e2e)

## Blocked by

- #60

