# Sheet feel: forgiving drag handle + bottom safe-area margin

> GitHub issue #69 | Labels: ready-for-agent, P2 | https://github.com/taigamura/simple-bookkeeping/issues/69

## Parent

#64

## What to build

Two style-only improvements to the shared sheet host, both about how sheets feel:

1. **More forgiving drag handle.** Replace the sheet host's default handle with a custom handle: the same small visual pill centered inside a taller (~40px), full-sheet-width transparent touch band, so drag-to-dismiss has a generous target that barely requires aim. The visual pill stays the same size. The band must not overlap the sheet header's title / ✕ button.
2. **Bottom margin on sheets.** Add the device bottom safe-area inset to the shared sheet host's content bottom padding, so every sheet — Settings included — clears the home indicator instead of sitting flush against the screen edge.

Style-only; verified by eye on the dev-web build per the repo's verify flow. Numeric values (band height, extra inset) are starting points to tune during verification.

## Acceptance criteria

- [ ] The sheet drag handle has a noticeably larger (taller, full-width) touch target while the visible pill is unchanged
- [ ] The enlarged handle band does not overlap the sheet header title / ✕ button
- [ ] Drag-to-dismiss still works from the handle band
- [ ] Every sheet's bottom content clears the home indicator with a margin (verified on a home-indicator device / dev web)
- [ ] Settings' last row (Import from Zaim) is no longer flush to the bottom edge
- [ ] Verified by eye; no regression to existing sheet open/close/scroll behavior

## Blocked by

None - can start immediately

