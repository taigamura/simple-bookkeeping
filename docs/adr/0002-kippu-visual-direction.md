# ADR-0002 — Kippu 切符 visual direction

- **Status:** accepted (2026-07-31)
- **Supersedes:** the "Design tokens" colour and radius tables in
  [`docs/build-decisions.md`](../build-decisions.md)

## Context

Kaji shipped with a dark-first, green-accented concept. We wanted a direction
merging two references: [@nemuiasaa](https://x.com/nemuiasaa)'s app work (warm
off-white ground, borderless white cards, generous whitespace, one-mark app
icons) and the mokumono app (electric blue, uppercase monospace, technical
rules).

Five directions were mocked and compared in
[`docs/mockups/light-directions.html`](../mockups/light-directions.html);
**Kippu 切符** was chosen, then refined in Claude Design where the pill-heavy
first pass was replaced with soft-filled rounded rectangles.

## Decision

**Colour.** Off-white ground, white cards, and a single hue. `positive` blue is
the only accent the UI carries — income, primary CTAs, selection. One saturated
`deep` block owns the headline number on Summary.

**Expenses read as ink, not red.** Red (`negative`) is reserved for things that
are *wrong*: over-budget category bars, a negative budget remainder, and
destructive actions. A month of ordinary spending is not an error state, and
colouring it red spent the strongest signal we have on the least urgent
information.

**Accents are per-mode, not shared.** The old `accents` constant assumed one set
of accent colours worked in both themes. It doesn't: `#2B33E8` is right on white
but only 2.5:1 against a near-black ground. Dark runs a lifted `#6B72FF` and
flips `onPositive` to near-black. All accent/surface pairings clear WCAG AA
(4.5:1); the contrast maths is why the two blues differ rather than one being a
tint of the other.

One deliberate deviation from the design file: it specifies `--dim: #9C9CA4`,
which is 2.4:1 on the ground. Since `dim` carries the 10px uppercase
micro-labels — real information, not decoration — it is darkened to the lightest
value that still clears AA.

**Shape.** Soft-filled rounded rectangles, not outlined pills: chips 9, keypad
keys 12, CTA 14, FAB 16, nav buttons 10, calendar cells 8, cards and the hero 20.
Only progress tracks stay fully round. Fills replace borders — controls sit on
`card2` rather than carrying a 1.2px outline.

**Type is unchanged.** The existing scale already ran JetBrains Mono for every
number and uppercase micro-label with `+.14em` tracking, which is the mokumono
half of the merge. Nothing in the type scale moved.

**The mark** is a stack of two rounded bars and a dot — the ledger read as
punched ticket stubs. Source in `assets/brand/kippu-mark.svg`; every raster is
generated from it by `npm run icons`.

## Consequences

- `theme/tokens.ts` is the single source of truth for colour, radius and shadow.
  The tables in `build-decisions.md` are history.
- Components must read colour from `useTheme().colors`, never from a
  module-level constant, or they will not respond to an appearance change
  (ADR-0001).
- Shadows were retuned for a light ground; the old `0 8 24 rgba(0,0,0,.4)` bloom
  read as dirt on off-white.
- `SplitBar` needs an `onDeep` variant because it now sits on the hero block.

## Open

- Calendar cells still truncate a wide day total (`+120,000` renders as
  `+120,0…`) at 7-column phone width. Pre-existing, not made worse; the dot
  variant explored in the design file is the fallback if it matters.
