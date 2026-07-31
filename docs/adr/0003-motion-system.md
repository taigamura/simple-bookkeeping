# ADR-0003 — Motion system

- **Status:** accepted (2026-07-31)
- **Builds on:** [ADR-0002](0002-kippu-visual-direction.md) (Kippu visual
  direction), [ADR-0001](0001-follow-os-appearance.md) (follow the OS)

## Context

Kaji shipped with essentially no motion. The only animated surfaces were the
bottom sheet (which came free with `@gorhom/bottom-sheet`) and a throwaway
prototype. Every other state change — selecting a day, switching months,
switching tabs, saving an entry — was a hard cut.

Hard cuts are not neutral. In this app three of them actively cost the user
information:

- **Saving an entry** gave no confirmation beyond the sheet closing and a
  haptic. There was nothing tying the act of saving to the place the entry
  landed, which is the one causal relationship the app exists to express.
- **Switching months** changed six things at once (title, In/Out/Net strip, the
  grid, the day list) with no indication of direction, so a swipe and a chevron
  tap were indistinguishable from a data reload.
- **Changing totals** replaced one number with another. Nothing said the new
  figure was the *same* figure having moved.

Reanimated 4 was already a dependency (pulled in by the sheet), so the cost of
adopting motion was design, not payload.

## Decision

**Motion confirms and points; it never decorates.** Every animation in the app
answers one of: "your touch registered", "this went there", or "this is the
same thing, changed". Nothing loops, nothing plays on idle, and nothing blocks
input.

**Three shared token groups**, in `theme/motion.ts`, so motion reads as one
system rather than per-component taste:

- `durations` — `instant` 90 / `quick` 160 / `base` 240 / `slow` 380 /
  `wave` 620. Travel scales with distance. Only the save wave exceeds 400ms.
- `springs` — `press` / `snap` / `gentle` / `pop`. Expressed as
  damping/stiffness/mass rather than `dampingRatio` + `duration`, so an
  interrupted spring (a second tap before the first settles) behaves identically
  to an uninterrupted one, which the duration form does not guarantee.
- `easings` — `standard` is an ease-out expo; entrances and settles use it so a
  change feels like it has already happened by the time the eye arrives.

**Springs for anything a finger caused, timings for anything data caused.** A
tap should feel physical; a number changing because the month changed should
feel edited.

**The save is the one celebratory moment**, and it is split in two. An accent
bloom (`ui/SaveWave`) expands from the CTA *inside the Entry sheet*, and the day
cell the entry landed on plays a one-shot ring pulse. The full-screen version of
this effect was considered and rejected: it reads beautifully once, but at
thirty saves a day it is thirty half-second occlusions of the ledger the user is
trying to read. Scoping the bloom to the sheet and putting the arrival signal on
the destination says "this went there" without ever hiding the there.

Saving therefore carries **170ms of deliberate latency** (`WAVE_LEAD` in
`EntrySheet`) so the bloom plays before the sheet is told to dismiss. This is
under the ~200ms threshold where delay reads as lag, and the animation covers
the wait.

**Headline figures roll, row figures do not.** `ui/AnimatedNumber` ticks the
Summary hero, the In/Out/Net strip, and the day net. List-row amounts stay
instant: a dozen numbers counting at once is noise, and a row amount is a fact
about one entry rather than a total that changed. The roll runs on the JS thread
via `requestAnimationFrame`, not on the UI thread, because the formatters
(`yen`/`signed`) call `toLocaleString`, which is not worklet-safe — see that
file's header for the alternatives rejected.

**Reduced motion is a three-way preference, not a toggle**, persisted as
`AppState.motion` and surfaced in Settings beside Appearance. `system` follows
the OS accessibility flag; `full` and `reduced` pin it. "Off" and "follow the
OS" are genuinely different answers: a user with reduce-motion on system-wide
may still want Kaji's motion, and a user with it off may not want it here.

Components branch on `useMotion().enabled` and render the **end state**, rather
than running the same animation at zero duration — a zeroed animation still
schedules layout work and still fires completion callbacks a frame late.

## Consequences

- `useMotion()` deliberately **does not throw** outside a provider (unlike
  `useTheme()`), returning `enabled: false`. Motion is an enhancement; a
  component with no colors is invisible, but a component with no motion is
  merely still. This is also why the entire pre-existing component suite passes
  untouched — no test had to be wrapped in a new provider.
- **`react-native-reanimated/mock` constrains what may be written.** Its
  `interpolate`/`interpolateColor` return `undefined`, so neither may appear in
  a style — use plain arithmetic in worklets. Its `withSequence` returns `0`, so
  any sequence must have `0` as its resting value. There is no
  `useReducedMotion`, which is a second reason `MotionProvider` reads
  `AccessibilityInfo` directly.
- Color transitions are done by **cross-fading two stacked colored layers**
  (the tab icons, the day-cell accent fill, the category chips) rather than
  animating `backgroundColor`, for the same mock reason and because animated
  color interpolation on `react-native-web` is unreliable.
- `MonthPager` and `BottomSheet` were left alone on purpose. Both file headers
  document hard-won bugs — eaten flings (#48), the "sheets never reopen" ghost
  backdrop (#63) — and the month "whoosh" is instead produced by animating the
  things *around* the pager: a directional title slide, the strip figures
  rolling, and the day list cross-fading at commit.
- Adding a field to `AppState` remains backward-compatible: `motion` is in
  `additiveStateKeys`, so blobs written before this shipped load with the
  default.

## Amendment (2026-07-31): the save bloom and tab switch were imperceptible

Reported directly by Taiga after using the app: "I only see the calendar
movement animation." Verified by measurement, not assumption — screenshot
diffing (`n` frames per interaction vs the settled end state) and, for the day
cell, sampling `getComputedStyle` on every `requestAnimationFrame` tick, which
resolves far finer than a screenshot burst can.

**Save.** `WAVE_LEAD` (170ms) was tuned to the "~200ms lag threshold" rule, but
`SaveWave`'s spread only reaches full size at 70% of `durations.wave` (≈434ms).
At 170ms it was ~13% grown when the sheet's own 200ms dismiss began sliding
over it, so by the time the sheet cleared, nothing was left to see. The
landing pulse was worse: it fired the instant `onSave` ran — the same moment
the dismiss started — so it played out entirely *underneath* the closing
sheet. Two independent fixes: `WAVE_LEAD` raised to 380ms (the "~200ms lag"
rule doesn't apply here — for the whole lead the user is watching the bloom
actively grow from the button they pressed, which *is* the feedback, so it
doesn't read as a stall); and the pulse is now deferred by
`SHEET_ANIMATION_DURATION` (200ms, newly exported from `nav/BottomSheet.tsx`
rather than re-guessed) so it fires once the sheet has actually cleared the
day cell it's pulsing.

**Tab switch.** Ran `entering={FadeInRight/FadeInLeft}` — reanimated's web
implementation renders these as a fixed 25px CSS keyframe translate, not
independently tunable from duration. Measured peak: 17% of the screen
changing, settled by ~160ms. Replaced with a hand-rolled `TabTransition`
component using the same `useSharedValue`/`useAnimatedStyle` pattern as
`CalendarScreen`'s (proven, working) title slide — 36px of travel over 280ms,
both plain numbers this codebase controls.

Day selection and the month "whoosh" were re-verified as already working
during this pass — the initial screenshot-diff pass showed 0% change for day
selection, which turned out to be a probe bug (a stale DOM reference in the
verification script, not the component), corrected by re-querying the target
every frame; the corrected trace showed a clean 0→1.06 scale / 0→1 opacity
spring over ~360ms.

## Amendment (2026-07-31, second pass): the bloom still wasn't a *wave*

Taiga reported the wave still wasn't visible after the WAVE_LEAD/pulse-timing
fix above. The lead/pulse fix was real and necessary but incomplete — it fixed
*when* the bloom got screen time, not *what it looked like* once it had it.

Sampled `getComputedStyle` on the bloom element every animation frame (the
same method as the day-cell trace) rather than trusting the earlier
screenshot-diff numbers, which turned out to be measuring the wrong thing for
this specific question: they diffed against the settled *calendar* screen, so
the mere presence of the *open Entry sheet* — keypad, chips, amount, all of
it — already accounted for most of the "changed" percentage regardless of
whether the bloom itself was doing anything legible.

The frame trace showed the actual bug: `SaveWave`'s circle is deliberately
oversized (~2.2× the sheet's larger dimension, ~1615px on a 500px-wide
viewport) so it can flood the whole surface from a near-bottom origin. It was
animated with `easings.standard` — an ease-out curve, front-loaded by design.
Front-loading a curve whose target is already 3× the viewport means the circle
crossed the visible edges by ~120ms, a fifth of the way through its own
430ms growth. The scale value kept changing after that — the animation was
genuinely still running — but there was no edge left on screen to show it
moving, so it read as a flash, not a wave. A screenshot at ~120ms (taken
during the *first* pass's verification) showed the sheet uniformly blue with
no visible curve; that was treated as confirmation the fix worked, when it
was actually evidence of the remaining bug.

Fixed by switching the spread to `easings.exit` (ease-in — slow start, fast
finish). Re-measured: scale now stays under 0.2 (a ~320px circle, clearly
smaller than the frame) until ~230ms, and doesn't cross the viewport width
until ~365ms — a real, trackable growth phase. Confirmed visually as well as
numerically: a screenshot burst after the fix shows a distinct circular arc
rising from the CTA, not a flat fill.

**Lesson for next time touching this component:** a diff-against-settled-state
metric answers "did the screen eventually change", not "did this specific
element read as intentional motion" — for that, sample the element's own
computed style per frame, and look at screenshots for shape, not just presence
of change.

## Amendment (2026-07-31, third pass): the shape fix didn't reach Chrome

Taiga still reported no visible wave after the shape fix above, and confirmed:
motion preference is `Full` (not the OS-flag theory), same dev-web setup as
this project's verification pipeline (not a different surface), browser is
**Chromium-based** (Chrome/Edge/Brave).

This project's verification is Firefox-only — Chromium cannot launch in this
sandbox (`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` gets it past a host-deps
check, but there's no working `libasound.so.2` and no sudo to install one).
Every measurement in the two amendments above, including the ones that looked
conclusive, only ever ran in Firefox. **This ADR has no direct Chromium
verification for the fix below** — it is the best fix derivable from the
evidence, not a confirmed-working one, and needs the reporter's own retest.

`SaveWave`'s growth was `transform: scale()` on a box whose *unscaled* size is
~2.2× its `overflow: hidden` container (see "Sizing" above — deliberate, so
the bloom can flood from a near-bottom origin). `transform` is compositor-only
by design: a browser is permitted to skip repainting the layer under it,
trusting that only position/scale changed, not paint content. That trust
breaks down for a box already vastly exceeding its clipping ancestor's bounds.
Chromium has long-standing, documented bugs in exactly this shape — an
oversized, clipped, absolutely-positioned element that only gets a
`transform` update can fail to repaint until something else forces a layout
pass. Firefox does not appear to share this failure mode, which is at least
consistent with (not proof of) three straight rounds of "works here" from a
Firefox-only pipeline paired with "still doesn't work" from Chromium.

Rewrote the growth to animate real `width`/`height`/`left`/`bottom` each
frame instead of a fixed box plus `transform: scale`. Every frame is now a
genuine layout+paint, which no browser can silently elide — the one property
this removes cheapness for is a single circle animating once per save, not
something perf-sensitive enough to matter. `opacity` stays untouched (not
implicated: it doesn't interact with the ancestor's clip the way size does).
Re-verified in Firefox only: the growth curve and screenshots are visually
identical to the pre-rewrite version, confirming the rewrite is at minimum not
a regression there.

## Amendment (2026-07-31, fourth pass): the real root cause, found with real data

The clipping-bug theory above was wrong. Rather than guess a fifth time, added
temporary `console.log` diagnostics to `SaveWave` and asked the reporter to
paste back Chrome's actual console output. The first line answered everything:

```
[Reanimated] Reduced motion setting is enabled on this device. This warning is
visible only in the development mode. Some animations will be disabled by
default. ...
```

**Reanimated has its own reduce-motion gate, entirely separate from
`useMotion()`.** Every `withTiming`/`withSpring`/`withSequence` call defaults
to `reduceMotion: ReduceMotion.System`, which independently checks the
OS/browser's reduce-motion flag and, when it's on, silently snaps straight to
the end value — with only a one-time dev-console warning to say so, easy to
miss among the framework's other boot-time logging.

This is a *second* gate underneath Kaji's own `full`/`reduced`/`system`
preference, not the same one. The whole point of Kaji's preference is to let a
user override the OS setting *inside the app* — but that override only ever
controlled whether this app's code *called* `withTiming` at all.
`useMotion().enabled` correctly resolved to `true` for a user who picked
"Full" (confirmed: the diagnostic logged `enabled: true`), the call happened,
and Reanimated silently reduced it anyway, underneath that decision. Every
animation built across this whole motion system went through this hole —
`SaveWave`'s bloom, the landing pulse, day-cell selection, chip fills, the
segmented pill, the tab slide, the title slide, list-row enter/exit,
`CategoryBar`/`SplitBar` growth, press-scale — all of it, for any user whose
OS/browser reports reduce-motion, regardless of what they picked in Kaji's own
Settings.

It also retroactively explains the *very first* report in this thread ("I
only see the calendar movement animation where numbers are animated"):
`AnimatedNumber` rolls via a hand-rolled `requestAnimationFrame` loop, not
Reanimated's `withTiming`, so it was never subject to this gate — it was
telling the truth about being the one thing that worked, for a reason nobody
suspected until round four.

**Why three earlier passes didn't find it:** this project's whole
verification pipeline is Firefox-only (Chromium cannot launch in this
sandbox), and reduce-motion is not on by default in that environment, so
every measurement — screenshot diffs, per-frame `getComputedStyle` sampling —
kept "confirming" fixes that were real, harmless improvements to timing and
shape, but were never going to touch the actual gate, because the actual gate
never engaged in the environment doing the verifying.

**The fix**, in `theme/motion.ts`: `withAppTiming`/`withAppSpring`/
`withAppSequence` wrap the three respective Reanimated primitives, forcing
`reduceMotion: ReduceMotion.Never` on every call. This is safe *specifically
because* every call site already sits inside an `if (enabled)` branch keyed
off `useMotion()` — by the time either wrapper runs, the app has already
folded in both the OS flag and the user's override into one decision;
Reanimated re-applying the OS flag a second time was the entire bug, not a
safety net worth keeping. Layout-animation builders (`FadeInDown`, `FadeOut`,
`LinearTransition` in `ui/ListRow.tsx` and `screens/SummaryScreen.tsx`) have
no import-swap equivalent — each needs `.reduceMotion(ReduceMotion.Never)`
chained explicitly, which is now done at every use.

`screens/SummaryScreen.tsx` already had a comment reasoning about exactly this
risk and concluding, incorrectly, that gating the whole `entering`/`layout`
prop on `useMotion().enabled` was sufficient — it wasn't, for the reason
above. That comment (and `ui/ListRow.tsx`'s equivalent) has been corrected in
place rather than deleted, so the wrong reasoning stays visible next to the
right one.

**Not independently verified in Chromium** — no fourth Firefox-only claim of
"confirmed working" would mean anything at this point. The reporter's own
console output is what found this; their retest is what will confirm it.

## Lesson

Four rounds, in order: a real timing bug (fixed), a real shape/perceptibility
bug (fixed), a plausible-but-wrong browser-compositing theory (an honest
improvement, not the fix), and the actual root cause — found only once actual
diagnostic data left the reporter's machine and reached this one. The first
three rounds were not wasted (each fixed something real), but none of them
would have found round four's bug no matter how long the Firefox-only
verification loop continued, because the bug lived entirely outside what that
loop could see. When a fix is "verified" but the reporter still sees the
original symptom, the fastest path is not a fifth theory — it's getting one
piece of real data (a console dump, a screenshot, a DOM query) out of the
environment the loop can't reach.

## Open

- The bloom is clipped to the Entry sheet's content box. On a very short phone
  where the sheet opens near its minimum height, the circle reaches full spread
  before it has visibly travelled. Acceptable, but a height-aware diameter would
  read better. (The sheet itself no longer overruns short screens — see
  [ADR-0004](0004-entry-sheet-fits-its-screen.md), a pre-existing layout bug
  found while verifying this work, not caused by it.)
- `e2e/app.ts`'s `dayIsSelected` probe reads the day tile's own
  `backgroundColor` and assumes unselected cells are transparent. That stopped
  being true when Kippu gave every cell a `card` fill, and the animated
  selection path now moves the accent onto a separate fill layer as well. The
  probe needs rewriting against the fill layer before the e2e suite can be
  trusted on selection — independent of the pre-existing sheet-reopen failure
  that already has the suite red.
- Nothing animates on first app launch, deliberately — an entrance on the
  calendar grid would put an animation between the user and their first
  meaningful paint. Worth revisiting only if launch stops feeling instant.
