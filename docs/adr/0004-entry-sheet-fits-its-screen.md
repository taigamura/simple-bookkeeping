# ADR-0004 — The Entry sheet fits its screen

- **Status:** accepted (2026-07-31)
- **Amends:** the "fixed-form, non-scrollable" contract between
  `screens/EntrySheet.tsx` and `nav/BottomSheet.tsx`

## Context

The Entry sheet was built as a fixed-form layout with no scroll, deliberately:
you should see the amount, the categories and the keypad at once, because
entering an expense is a single glance-and-tap.

That intent did not survive contact with a short screen. The form has an
intrinsic height of ~760px that never varied with the device, while the sheet
caps itself at the container height minus its chrome. `enableDynamicSizing` is
off and the host's manual `contentHeight` path only ever grew the sheet *up to*
that cap — nothing ever shrank the form. So below roughly an 810px window the
content simply overran its box, and because the CTA sits at the bottom, the
button the user opened the sheet to press was the first thing clipped away, with
no scroll to reach it.

Measured on dev web before the fix — identical with motion on and off, so this
was structural and not a consequence of ADR-0003:

| frame | sheet height | content height | CTA bottom | reachable |
|------:|-------------:|---------------:|-----------:|:---------:|
| 900   | 766          | 760            | 873        | yes       |
| 760   | 626          | 760            | 873        | **no**    |
| 680   | 546          | 760            | 873        | **no**    |
| 620   | 486          | 760            | 873        | **no**    |

## Decision

Two mechanisms, doing two different jobs.

**1. The CTA is pinned.** The form is now a scrollable body plus a footer holding
the CTA (and, in edit mode, Delete). The footer lives outside the scroll view and
is laid out against the bottom of the sheet, so the primary action is reachable
at any height whatsoever. This is the correctness guarantee.

**2. The form scales toward its screen.** A compact factor derived from the
window height shrinks the keypad, the hero amount, the option rows and the
vertical gaps. This is *not* a correctness mechanism — it is what stops an
ordinary phone from having to scroll a form that was designed not to.

The factor is derived from the **window**, not from a measured available height.
Measuring would close a loop — scale → intrinsic height → sheet detent →
available height → scale — that can visibly oscillate before settling. The
window is an independent input, so the factor resolves in one pass.

**Scaling stops at hard floors**, not at whatever fits: keypad keys never go
below 44px tall, option rows below 40px, glyphs below 18px. A control that keeps
shrinking to fit eventually becomes a control you cannot reliably hit, and a
calculator you mis-tap is worse than one you have to scroll. Below the floors the
remainder is taken as scroll.

`SHEET_CHROME` and `WEB_FRAME_INSET` are now exported from `nav/BottomSheet.tsx`
so the form computes its budget from the host's own constants instead of keeping
a second copy that would drift. No behaviour in the host changed.

## Consequences

- Every window height from 560px up now shows a reachable CTA, verified by
  driving dev web and actually completing a save at each one — geometry alone is
  not proof that a button works.
- Body height now scales 760 → 677 → 620 → 606 (floored) as the window shrinks.
  At an 800px window only the last keypad row scrolls.
- `EntrySheet` gained a `ScrollContainer` prop, following the same pattern
  Settings/Budgets/Repeats already use (#44): plain `ScrollView` by default so
  the component renders standalone in tests, `BottomSheetScrollView` in the real
  app so an in-sheet drag scrolls the body instead of fighting the sheet's pan
  gesture.
- The height reported to the host is now **body + pinned footer**, measured
  separately and summed. Reporting the body alone would ask for a sheet exactly
  too short to show the CTA — the original bug. The test that asserted the old
  single-measurement contract was rewritten, and two tests were added: one
  pinning the sum, one asserting the CTA is not a descendant of the scrollable
  body.
- `useCompactScale` deliberately approximates the safe-area insets rather than
  calling `useSafeAreaInsets()`, which throws outside a `SafeAreaProvider` and
  would make the component unrenderable in isolation. Being a few pixels out
  only nudges a soft heuristic.

## Open

- The compact factor is continuous, so two devices a few pixels apart render
  fractionally different keypads. Snapping to two or three named sizes would be
  more predictable to design against, at the cost of a worse fit on the
  in-between screens.
- Nothing signals that the body scrolls beyond the keypad being visibly cut off.
  On the shortest screens a fade or a rule at the scroll boundary would make the
  affordance explicit.

## Amendment (2026-08-10): confirmation is no longer sheet-sized

The Entry sheet remains responsible only for form sizing and draft collection.
Save confirmation is rendered by the app-shell canvas, so an absolutely
positioned wave cannot affect the measured body or pinned-footer detent and is
not clipped when the sheet dismisses. Its origin remains near the bottom of
the canvas, matching the CTA without claiming OS-owned inset regions.
