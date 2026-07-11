# Sheet presentation reliability: mount content before present, safe-area top inset

> GitHub issue #47 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/47

## Parent

#46 (Build #5 PRD) — workstream 1.

## What to build

Make the Entry and Settings sheets open correctly and reliably every time. All symptoms arrived with the `@gorhom/bottom-sheet` migration (#39/#44); keep the library and fix the integration:

- Sheet bodies are currently mounted conditionally *after* the modal's imperative present() is mirrored from the controlled `visible` prop, so the dynamically-sized modal can present before any content exists to measure. Render the sheet content unconditionally inside the modal (or defer present() until content is mounted) so dynamic sizing always measures real content. Expected to resolve: blank first open, collapsed-at-bottom initial detent, and the dead "＋" until a Settings open/close cycle.
- Set the modal's top inset from the device safe-area insets so the full-height detent stops below the status bar, making the Settings sheet's Done button fully tappable.

Note: the related "sheets stop opening after month swipes" symptom is verified under the pager rework issue, since deleting the calendar's custom pan gesture is its suspected fix.

## Acceptance criteria

- [ ] Fresh launch → tap "＋" → Entry sheet opens, with no prior Settings open/close cycle (verified on a physical iPhone).
- [ ] Entry sheet opens at its resting content-height detent, every time.
- [ ] Settings sheet opens at its resting content-height detent, every time.
- [ ] Settings sheet renders its content on the very first open — never blank.
- [ ] At the full-height detent, the Settings sheet's Done button sits below the status bar and is comfortably tappable.
- [ ] Drag-to-dismiss, drag-to-full detent behavior, and the fading backdrop from #39/#44 all still work.
- [ ] Existing sheet-related tests pass; component tests updated if the mounting contract changes.

## Blocked by

None - can start immediately

