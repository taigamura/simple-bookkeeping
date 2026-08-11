# Issue #120 craft, accessibility, and motion review

Reviewed 2026-08-11. This is a bounded review of the surfaces changed by the
CSV-import journey and the existing app-canvas save confirmation. It does not
change the visual direction, public product name, or navigation model.

## Evidence and outcomes

| Check | Small iPhone (375 × 667) | Large iPhone (430 × 932) | Light / dark | EN / JP | Reduced / full motion | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Settings and Import data row | `e2e/craft-review.spec.ts` checks the 44pt minimum and viewport visibility at 375 × 667. | Covered by the canonical 430 × 932 Playwright sheet suite and the large-screen review probe. | The review probe runs light and dark browser appearance; theme tokens supply the row fill and readable ink. | The probe uses EN and JP locales; dictionary tests require matching key shapes. | The small-screen probe runs with reduced motion; the action is instant. | Pass |
| Import preview, cancellation, and outcome copy | No sheet reflow occurs before the platform picker or confirmation alert. | Same code path and picker limits. | Native alerts are OS-owned; app copy remains token-independent. | Provider, tally, cancellation, and failure strings are localized. | No decorative motion is introduced. | Pass |
| Save-wave app-canvas overlay | Host is absolute within `AppShell`, pointer-transparent, and excludes OS-owned areas. | Same layout is based on the measured app canvas rather than a sheet height. | Uses the active theme's positive accent. | The effect has no spoken copy and does not change focus order. | Full: width/height circle expansion with a readable ease-in shape. Reduced: no circle, while the destination state still updates. | Pass (focused source and unit evidence) |

## Accessibility findings fixed

- `Import data` was exposed as a button but did not tell VoiceOver users which
  providers it accepts or that the ledger remains unchanged until they review
  the preview. Its localized accessibility hint now supplies both facts.
- The Data action rows are 46pt high, have explicit button roles and labels,
  and preserve their visual order in the accessibility tree.
- The save-wave host remains `pointerEvents="none"`; it cannot steal a touch or
  become a focus stop while a sheet is dismissing.

## Focused motion checks

- `e2e/craft-review.spec.ts` saves one entry under Full motion and samples the
  live wave: it must have non-zero equal width/height and a radius equal to
  half its width. `SaveWave` grows real width/height rather than a
  transform-only oversized layer, uses the shared 620ms wave token, and begins
  from the CTA's near-bottom origin.
- `Root` increments the wave nonce only after a successful durable update. A
  failed persistence result produces no wave; the landing pulse is deferred by
  `SHEET_ANIMATION_DURATION` so it is not hidden below the dismissing sheet.
- `MotionProvider` tests cover System, Full, and Reduced resolution, including
  Full overriding an OS reduced-motion setting. The motion wrappers force that
  already-resolved decision through Reanimated without a second OS gate.

## Verification commands

Run from the repository root:

```bash
npm run typecheck
npm test -- --runInBand
npm run e2e:export
npm run e2e:test
```

Native VoiceOver and Dynamic Type remain release-device checks in
[`accessibility-core-journey.md`](accessibility-core-journey.md). This review
keeps that checklist current rather than claiming simulator or device coverage
that was not performed in this repository session.
