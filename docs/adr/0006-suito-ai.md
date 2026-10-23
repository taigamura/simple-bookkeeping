# ADR-0006 — Suito AI: on-device first, Apple cloud and Siri as opt-in power

- **Status:** accepted (2026-10-23), in build on `feat/suito-ai`
- **Amended 2026-10-23 (build start):** (1) no App Group — App Intents compile
  into the main app target and share the app's own Documents dir, so no
  entitlement/profile change; (2) the Apple cloud-model switch is compiled out
  of 1.1.0 because the privacy gate couldn't be verified (no network), so the
  local Mac (iOS 26.2 SDK) can build it. PRD: `docs/prd/suito-ai.md`.
- **Amended 2026-10-23 (PRD #145):** 1.1.0 also gets a Calendar AI orb
  (hold = on-device speech → parsed entry pre-fills the Entry sheet; tap =
  Ask scoped to the visible month), receipt scan (VisionKit camera + Vision
  OCR → parse), and three code-computed one-liners worded by the model
  (`wordLine`): month-end forecast, day note, monthly-repeat suggestion.
  Speech is on-device only (`requiresOnDeviceRecognition`); receipt images
  are never kept, so "Data Not Collected" holds. Receipt scanning was out of
  scope in #143 and is now in. The orb stays still when idle (ADR-0003), and
  the Calendar body ends above a 72px orb band.
- **Supersedes:** the 切符 stamp-card twist (proposed 2026-10-07, dropped)

## Context

Downloads are near zero and the listing alone won't fix that. Research
(competitors, JP 家計簿 culture, habit mechanics) showed the top reason people
quit a 家計簿 is that logging is a chore, and that no JP budget app offers
offline AI. Taiga wants a local AI by default and stronger AI when the user
asks for it, "like ChatGPT linked in Siri". voice-memo already ships Apple's
on-device Foundation Models (`modules/koemori-ai`), built on the same Mac.

## Decision

One release, "Suito AI".

**In-app, on-device model** (Apple Intelligence phones only; hidden elsewhere):
- Plain-words entry: a text line in the Entry sheet fills amount / category /
  date / note; the user still taps Save.
- Monthly letter: a Summary card for last month, written once on first open
  of the month and saved. No notifications.
- Nudges: the model picks 0–1 from a code-computed fact sheet and must cite
  fact IDs; on-screen numbers come from the cited facts. Kindness post-filter,
  at most one refresh a day.
- Ask chat: a sheet from the Summary hero.

**Stronger AI, opt-in:**
- Ask chat can switch to Apple's Private Cloud Compute model (iOS 27).
  Off by default; a one-time explainer offers it the first time a question is
  too hard. Free within the user's Apple daily limit, so no keys and no
  server of ours.
- 「ChatGPTで聞く」: a prepared prompt (shown first) goes to the share sheet;
  the user sends it, not Suito.
- Siri / Shortcuts App Intents: add entry, period summary, spending by
  category, find entries. Entries are indexed in Spotlight, on by default,
  with a Settings switch that turns it off and clears the index.

**Architecture:**
- JS stays the only writer and the only place that does the maths. After every
  save it writes a snapshot (entries, repeats projected ±12 months, totals) to
  an App Group file. Swift reads it. Siri's "add entry" writes to an inbox
  file that the store merges on next foreground.
- Code computes every number; models only word them.
- New local Expo module `modules/suito-ai`, copied and adapted from
  koemori-ai (availability, error mapping, token budget, streaming).
- Minimum iOS raised to 26; the cloud model is gated at runtime on iOS 27.
- Production build on EAS cloud (needs the iOS 27 SDK; the 2012 Mac tops out
  at Xcode 26.3). The Mac stays for compile checks.

**Privacy gate:** before building the cloud switch, confirm whether Apple
counts an app's Private Cloud Compute requests as data collection. If it does,
ship without the switch and keep "Data Not Collected".

**Testing:** one JS contract for the AI; web/e2e inject a deterministic fake
for Playwright geometry checks and screenshot baselines. Jest covers the
parser, fact sheet, citations, snapshot writer and inbox merge. A TestFlight
checklist covers the real model, the cloud model, Siri, Spotlight, and the
hidden state on unsupported phones.

## Consequences

- Spotlight on by default exposes entries and notes to anyone with the
  unlocked phone; Suito has no app lock.
- iOS 27 / Private Cloud Compute facts (free under 2M downloads, daily
  limits) come from WWDC26 search summaries, not primary docs. Verify them.
- EAS free tier is slower and limited; source goes to Expo's builders.
- ADR-0003 (no idle motion) still applies: AI UI confirms and points, no
  looping "thinking" mascots.
