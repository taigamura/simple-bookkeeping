## Problem Statement

Suito is live on the App Store but gets almost no downloads, and the people who try a 家計簿 usually quit: in surveys, more than 70% of women and 50% of men have given up on one, mostly because logging feels like a chore and they get no feedback on what the numbers mean. Competing apps answer this with bank linking, ads and paid tiers, which Suito deliberately refuses. Nobody in the Japanese market offers an AI 家計簿 that keeps your data on your phone. Users who want smarter help (ChatGPT, Apple Intelligence) can't point it at their Suito ledger today, because Suito exposes nothing to Siri, Shortcuts or Spotlight.

## Solution

"Suito AI": a private AI layer that runs on the iPhone by default and reaches further only when the user chooses.

- On iPhones with Apple Intelligence, Suito's on-device model lets you log by typing or dictating plain words (「昨日 スタバ 620」), writes a kind letter about last month, offers one gentle observation (a nudge) at a time, and answers questions about your money in an Ask sheet.
- If the user opts in, Ask can use Apple's larger cloud model (Private Cloud Compute, iOS 27). The user can also hand a prepared question to ChatGPT or any other app through the share sheet; the user sends it, not Suito.
- Every iPhone on iOS 26 gets Siri and Shortcuts actions (add an entry, summaries, spending by category, find entries) and Spotlight search of entries. That lets the user's own Siri, Shortcuts "Use Model" or linked ChatGPT reason over the ledger, the same way Siri hands off to ChatGPT.
- Every number shown or spoken is computed by Suito's code. The models only choose and phrase. "Data Not Collected" stays true.

## User Stories

### Plain-words entry
1. As a user on an Apple Intelligence iPhone, I want a text line at the top of the Entry sheet, so that I can log an entry by typing a phrase instead of using the keypad.
2. As a user, I want to dictate the phrase with the keyboard microphone, so that logging works hands-free.
3. As a user, I want 「ランチ 850」 to fill amount 850 and pick my Food category, so that I don't have to pick a category by hand.
4. As a user, I want 「昨日」「おととい」「10/3」 to set the entry date, so that I can catch up on missed days.
5. As a user, I want words like 給料 or ボーナス to switch the entry to income, so that income is logged correctly.
6. As a user, I want leftover words (e.g. 「スタバ」) to become the note, so that I keep the detail.
7. As a user, I want the model to choose only from my own categories, so that it never invents a category.
8. As a user, I want the filled fields shown before anything is saved, so that I can fix a wrong guess.
9. As a user, I want to save with the normal Save button and the usual save wave and haptic, so that saving feels the same as before.
10. As a user, I want the keypad and category chips to keep working after the text fills them, so that I can adjust anything.
11. As a user, I want the text line to show a quiet "working" state and never block typing, so that the sheet stays responsive.
12. As a user, I want a phrase the model can't understand to leave the form untouched, so that nothing wrong gets filled in.
13. As an English-locale user, I want 「lunch 12.50」 style phrases to work too, so that the feature isn't Japanese-only.
14. As a user without Apple Intelligence, I want the Entry sheet to look exactly as it does today, so that nothing broken appears.

### Monthly letter
15. As a user, I want a 「10月のふりかえり」 card on Summary for last month when I open the app in a new month, so that I get a reflection without asking.
16. As a user, I want the letter to be kind and never scold, so that reading it doesn't make me want to quit.
17. As a user, I want the letter's numbers (spending vs last month, top category, no-spend days, budget kept or not) to be exact, so that I can trust it.
18. As a user, I want the letter written once and saved, so that it doesn't change every time I open Summary.
19. As a user, I want to dismiss the letter card, so that Summary stays clean.
20. As a user, I want to reopen any past month's letter from that month's Summary, so that I can look back.
21. As a user with no entries last month, I want no letter at all, so that I don't get an empty or invented reflection.
22. As a user, I want the letter in my device language, so that it matches the rest of the app.
23. As a user, I don't want notifications about the letter, so that Suito stays quiet.

### Nudges
24. As a user, I want at most one short observation under the Summary hero, so that I notice patterns without nagging.
25. As a user, I want the model to decide which observation is worth saying, or to say nothing, so that nudges feel smart, not templated.
26. As a user, I want every nudge to be grounded in facts the app computed, so that it never makes up a number.
27. As a user, I want numbers in a nudge rendered from the cited fact, not from the model's text, so that they are always correct.
28. As a user, I want nudges to stay kind or neutral, so that spending more never gets me scolded.
29. As a user, I want a nudge refreshed at most once a day, so that it doesn't flicker or change on every open.
30. As a user, I want to dismiss a nudge, so that I can clear it.
31. As a user, I want to turn nudges off in Settings, so that I'm in control.

### Ask
32. As a user, I want an 「聞く」 pill on the Summary hero that opens an Ask sheet, so that I can ask about my money next to my numbers.
33. As a user, I want to ask 「今月コンビニいくら？」 and get the exact total, so that I get answers faster than browsing.
34. As a user, I want the answer to stream in, so that I see progress right away.
35. As a user, I want answers to come from Suito's computed data through tools (period totals, category totals, entry search), so that numbers are correct.
36. As a user, I want the model to say it doesn't know rather than guess, so that I can trust it.
37. As a user, I want a few follow-up turns in the same sheet, so that I can refine my question.
38. As a user, I want suggested starter questions in an empty Ask sheet, so that I know what to ask.
39. As a user, I want Ask to work offline on the on-device model by default, so that my data stays on my phone.
40. As a user, when a question is too hard for the on-device model, I want Suito to offer Apple's cloud model once with a short explanation (what is sent, that it goes to Apple Private Cloud Compute and isn't stored, the daily limit), so that I can choose a stronger answer knowingly.
41. As a user, I want one tap in that explainer to turn the cloud model on, so that opting in is easy.
42. As a user, I want a Settings switch for the cloud model (off by default), so that I can turn it on or off anytime.
43. As a user on iOS 26 (no cloud model), I want the cloud offer and switch hidden, so that I'm not offered something my phone can't do.
44. As a user who hits Apple's daily limit, I want a clear message and a fallback to the on-device model, so that Ask still works.
45. As a user, I want a 「ChatGPTで聞く」 action that shows me the exact prompt and data first, then opens the share sheet, so that I can send it to ChatGPT, Claude, Gemini or Notes myself.
46. As a user, I want that prompt to carry the computed totals and the relevant entries, so that the outside AI doesn't have to do arithmetic.
47. As a user without Apple Intelligence, I want the 「聞く」 pill hidden, so that I never open a dead sheet.

### Siri, Shortcuts and Spotlight
48. As a user, I want to say 「Suitoでランチ850円」 to Siri, so that I can log without opening the app.
49. As a user, I want a Siri-added entry to appear in Suito the next time I open it, so that nothing gets lost.
50. As a user, I want Siri's answers to already count entries I added by voice but haven't opened the app since, so that totals are current.
51. As a user, I want an "Add entry" Shortcuts action (and Action-button support), so that I can build quick-log shortcuts.
52. As a user, I want a "Summary" action for a month or date range (income, spending, net, budget left, no-spend days), so that Siri, Shortcuts "Use Model" or ChatGPT can reason over it.
53. As a user, I want a "Spending by category" action, so that 「今月食費いくら？」 works through Siri.
54. As a user, I want a "Find entries" action that returns entries for a period, category or text, so that other AI tools can analyse individual entries.
55. As a user, I want repeating entries (rent, salary, subscriptions) included in Siri's answers, so that they match what the app shows.
56. As a user, I want my entries searchable in Spotlight (e.g. 「スタバ」), so that I can find them from the home screen.
57. As a user, I want tapping a Spotlight result to open Suito on that entry's day, so that I can see it in context.
58. As a user, I want a Settings switch 「Siriと検索」 that turns Spotlight indexing off and clears the index, so that I can keep entries out of system search.
59. As a user, I want deleted or edited entries to disappear from or update in Spotlight, so that search never shows stale data.
60. As a user, I want Siri and Spotlight to work on any iOS 26 iPhone, even without Apple Intelligence, so that everyone benefits.

### Availability, privacy, trust
61. As a user without Apple Intelligence (or with it turned off), I want all in-app AI surfaces hidden, so that the app looks complete, not broken.
62. As a user who turns Apple Intelligence on later, I want the AI features to appear without reinstalling, so that the app adapts.
63. As a privacy-minded user, I want Suito itself to send nothing over the network unless I've turned on the cloud model, so that "Data Not Collected" stays true.
64. As a user, I want Settings to explain in one line what each AI switch does and where data goes, so that I understand my choices.
65. As a user, I want AI text never to contain em dashes and to read naturally in Japanese and English, so that it fits the app's voice.
66. As a user who uses Reduce Motion, I want AI surfaces to respect it, so that nothing loops or animates unnecessarily.
67. As a VoiceOver user, I want the text line, letter, nudge and Ask sheet to be labelled, so that the AI is accessible.
68. As the developer, I want the cloud-model switch shipped only if Apple confirms an app's Private Cloud Compute requests don't count as data collection, so that the privacy label is never false.

## Implementation Decisions

- **One native seam: `SuitoAi`.** A single JS contract that every AI and system-integration call goes through, injected at the app root the same way `Store` is (`createStore(persistence)` is the prior art). Three implementations: the iOS Swift module, a deterministic fake for web and Jest, and an "unavailable" stub. Shape (decision-level):
  - `availability()` → `{ onDevice: 'available' | 'unsupported' | 'disabled' | 'notReady', cloud: 'available' | 'unsupported' | 'limitReached' }`
  - `parseEntry(text, { categories, today, locale })` → `{ type?, amount?, categoryId?, date?, note? } | null`
  - `writeLetter(facts, locale)` → `{ paragraphs: string[], citedFactIds: string[] }`
  - `pickNudge(facts, locale)` → `{ factIds: string[], text: string } | null`
  - `ask({ question, history, model: 'onDevice' | 'cloud' }, tools)` → stream of cumulative text snapshots, plus `{ needsStrongerModel: boolean }` at the end
  - `writeSiriSnapshot(json)`, `readSiriInbox()` → `InboxEntry[]`, `clearSiriInbox(ids)`, `setSpotlight({ enabled, entries })`
- **Swift module `suito-ai`**: a local Expo module copied and adapted from voice-memo's `koemori-ai`: availability mapping, `GenerationError` → JS error codes, token budget heuristic, streaming snapshot pattern. Suito-specific `@Generable` types: parsed entry (category constrained to the passed list), letter, nudge (cited fact IDs), plus Foundation Models `Tool`s for Ask that call back into JS-computed data. The cloud model is selected per session on iOS 27 behind runtime `#available`. Post-processing in Swift: em dashes → 、 or `, `, unknown category IDs dropped, fact IDs not in the input dropped.
- **App Intents** in the same module: AddEntry, PeriodSummary, CategorySpending, FindEntries, with an `EntryEntity` that is indexed in Spotlight (`IndexedEntity`). Opening an entry routes to Calendar on that day.
- **Siri snapshot (JS → Swift bridge).** JS stays the only writer of the ledger and the only place that does the maths. After every successful store save (debounced), JS builds a versioned snapshot: entries, repeat occurrences projected ±12 months, precomputed monthly and category totals, budgets, categories, currency, locale. It writes the snapshot to a file in a new App Group container. Swift only reads it.
- **Siri inbox.** AddEntry appends to an inbox file in the App Group. On launch and foreground the store merges inbox items as normal entries (deduplicated by inbox ID), then clears them. Until the merge, Swift answers include inbox items.
- **Pure domain modules (no I/O)**:
  - fact sheet builder: about 15 facts with stable IDs (category pace vs last month, no-spend days and streak, budget left and pace, biggest day, new repeat detected, income vs last month), each with a value and its formatted display string
  - Siri snapshot builder
  - inbox merge
  - date-phrase and amount normalisation used to validate the model's parse
  - citation renderer: nudge and letter numbers rendered from fact display strings
  - share-handoff prompt builder for 「ChatGPTで聞く」
- **State additions** (persisted, merged with defaults, so no schema version bump): `ai.cloudEnabled` (default false), `ai.cloudOffered` (explainer shown once), `ai.nudgesEnabled` (default true), `ai.spotlightEnabled` (default true), `letters` keyed by year-month (text, cited facts, dismissed), `nudge` (last pick, date, dismissed).
- **UI:**
  - Entry sheet: text line above the amount
  - Summary: 「聞く」 pill on the hero, letter card under the hero, nudge row below it
  - Ask: a new bottom sheet using the existing sheet pattern
  - Settings: an "AI" section with the cloud-model, nudges and 「Siriと検索」 switches
  - All AI surfaces render only when `availability().onDevice === 'available'`; Siri and Spotlight don't depend on it.
- **Motion** follows ADR-0003: AI surfaces confirm and point, with no loops or idle "thinking" animation. Streaming text appears without a spinner loop.
- **Build config:**
  - Minimum iOS raised to 26.
  - Add an App Group entitlement and the Siri / App Intents capability.
  - Production builds run on EAS cloud (needs the iOS 27 SDK). The local Mac (Xcode 26.3) stays for compile checks of everything except iOS 27-only code.
  - Version bumps to 1.1.0.
- **Privacy gate:** before the cloud switch ships, verify in Apple's documentation that app-initiated Private Cloud Compute requests don't count as data collection. If unverifiable or they do, the switch and the explainer are compiled out and everything else ships.
- **Copy:** all new strings go in `i18n/strings.ts` for EN and JA. Model instructions are written in English with the user's locale stated, the same as koemori-ai.
- Decisions and rationale: ADR-0006.

## Testing Decisions

- **Good tests** check behaviour a user or caller can observe through the seam, not internals: given these entries, the fact sheet says X; given this fake parse, the Entry sheet fields show Y; given availability "unsupported", no AI surface renders.
- **Jest (unit/integration)**:
  - fact sheet, snapshot builder (projected repeats match `domain/summary` totals), inbox merge (dedup, merge-then-clear), citation renderer (numbers only from facts; unknown IDs dropped), handoff prompt builder
  - store save → snapshot write via the fake
  - Entry sheet, Summary, Ask sheet and Settings with the fake `SuitoAi` in each availability state
  - Prior art: `store/store.test.ts` (in-memory persistence injection), `screens/*.test.tsx`, `domain/summary.test.ts`.
- **Playwright (mandatory visual gate)**: the web build with `?ai=fake` drives:
  - the Entry text line filling fields
  - the Ask sheet with streamed answer, the cloud explainer, and the ChatGPT handoff preview
  - the letter card and the nudge row
  - the Settings AI section
  - the unavailable state (no AI surfaces)

  Assert geometry (on screen, aligned, not under the tab bar or keyboard) and commit `toHaveScreenshot` baselines for each state. Write red first. Prior art: `e2e/tabbar.spec.ts`, `e2e/sheets.spec.ts`, `e2e/app.ts` (coldLoad / tapAt).
- **Device checklist (TestFlight)**: real on-device parse in JA and EN; letter and nudge quality and tone; Ask with tools; the cloud model on iOS 27; the daily-limit fallback; Siri phrases; Shortcuts actions; Spotlight search, tap-through, and toggle-off clearing; the inbox merge after a Siri add; hidden state on a non-Apple-Intelligence iPhone.

## Out of Scope

- The 切符 stamp card and month-ticket share image (dropped).
- Bring-your-own API keys, a server of our own, paid tiers, or third-party model providers (Claude/Gemini packages).
- Rule-based (non-AI) fallbacks for unsupported phones; those phones get Siri and Spotlight only.
- Notifications, widgets, Live Activities, Control Center controls.
- Android and web AI (web uses the fake only for tests).
- Receipt scanning, bank linking, cloud sync.
- An app lock / Face ID gate (noted risk: Spotlight shows entries to anyone with the unlocked phone).
- Multi-entry paste in the Entry text line.

## Further Notes

- The iOS 27 Private Cloud Compute facts (free for small apps under 2M downloads, per-user daily limit, iCloud+ raises it, 32K context) come from WWDC26 session summaries, not primary docs. Verify them before relying on them.
- voice-memo's on-device lessons apply: an over-cautious prompt at temperature 0.1 returned nothing on device; keep temperature around 0.2–0.3 and post-process deterministically.
- The 2012 Mac build server can't run Xcode 27. Ship the TestFlight build from EAS cloud.
- Release as 1.1.0 ("Suito AI"). Update `store.config.json` listing copy (AI keywords: AI家計簿, オフラインAI) in the same release.
