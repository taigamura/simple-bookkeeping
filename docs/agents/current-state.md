# Current state (injected at session start)

Short, living summary of where the project is. It's injected into every new
Claude session by `.claude/hooks/session-context.sh`. **Update it in the same
change whenever a release ships, a decision lands, or an open item closes.**
Keep it under ~60 lines; durable reasoning belongs in `docs/adr/`.

_Last updated: 2026-11-06 (1.1.0 submitted for review)_

## Release

- App: **Suito** (bundle `com.taigamura.kaji`; ASC listing name is "Suito",
  verified via API 2026-10-03). Version **1.0 is live** on the App Store.
- **1.0.1 (build 69, native tab bar + new search-focused listing) is live**
  (READY_FOR_SALE, checked 2026-10-07). ~40 downloads total (owner-reported
  2026-11-06). Next change = new version.
- **1.1.0 (Suito AI) submitted for review 2026-11-06**, build **74**
  (`build-1793951558821.ipa`, main `410cf04` = squash of PR #144), review
  submission `061bd623`, WAITING_FOR_REVIEW. **releaseType MANUAL**: after
  approval Taiga must press Release (device-check build 74 on TestFlight
  first). ASC version id `3b67fd96-e0f2-4572-9b70-3f9517236199`.
- Growth push (PR #146): AI-first listing pushed to 1.1.0 (EN "Suito: AI
  Expense Tracker", JA "Suito - AI家計簿・簡単カレンダー"); new 6.9" screenshots
  (web-captured, custom tab bar) replaced the 6.5" V1 set; In-App Events
  "Meet Suito AI" (6831505029, 11/14–12/14) and New Year (6831506644,
  1/1–1/31/2027) in review (submission `2887d3aa`); featuring nomination
  `bb21c669` SUBMITTED; rating prompt (expo-store-review) in build 74.
  Launch post drafts in `docs/marketing/launch-1.1/` (not posted).
- Ship with `/ship-ios` (config: `.claude/ship.json`). Build and submit both
  need eas-cli >= 25 now (`npx -y eas-cli@25.3.0`); 21.8.0, still the Mac's
  global, fails with a bare "GraphQL request failed".

## Recent decisions

- **Orb → tab-bar accessory (2026-11-06, in build 74):**
  the orb left its floating Calendar band and now lives in UIKit's
  `tabViewBottomAccessory` (glass strip joined to the bar, Music mini-player
  slot) via `renderBottomAccessoryView`: sphere + "Suito AI" + hint, whole
  strip is the button, on both tabs (accessory belongs to the bar; toggling it
  per tab would rebuild the native TabView). Web/Android: same row as a card
  above the custom bar. `nav/CalendarOrb.tsx` → `nav/OrbAccessory.tsx`.
- **Entry sheet fit loop (ADR-0004 amendment, 2026-11-06):** window factor is
  now only the first guess; the body is measured against its scroll viewport
  and the factor steps down until it fits (min 0.5). Floors: keys 40pt, rows
  36pt; the Expense/Income caption hides below 0.8. Pinned by
  `e2e/entry-fit.spec.ts` (16 Pro / 16 / mini; mini + AI line still scrolls
  ~13pt at the floors).
- **Suito AI 1.1.0 (ADR-0006, PRD #143, branch `feat/suito-ai`):** on-device
  Foundation Models (plain-words entry, monthly letter, model-picked nudges,
  Ask sheet) + ChatGPT share hand-off + Siri App Intents + Spotlight (on by
  default). Swift reads a JS-written snapshot in the app's Documents dir (no
  App Group). Apple cloud model compiled out (privacy gate unverified). Min
  iOS 26; builds on the local Mac. Stamp-card twist dropped. `ja.lproj` now
  exists (Siri JA phrases), so UIKit system strings show in Japanese.

- **App Store listing lives in `store.config.json`** (EAS Metadata format);
  `npm run listing` diffs it against ASC, `-- --push` writes it. Search-focused
  rewrite (title/subtitle/keywords carry search terms) because downloads were
  near zero; ~40 by 2026-11-06. Name/subtitle/keywords/description only change on an editable
  version; promo text can change on the live one.

- **iOS tab bar = system `UITabBar`** (ADR-0005, PR #142). The ＋ is a
  separate glass circle. Web/Android keep the custom `TabBar`. Don't go back to
  faking Liquid Glass; if native doesn't satisfy, revert to the flat bar.
- **Browser + screenshot testing is mandatory** for every implementation
  (CLAUDE.md "Visual testing is mandatory"). Pattern: `e2e/tabbar.spec.ts`.
- Earlier ADRs: 0001 follow OS appearance, 0002 Kippu visual direction,
  0003 motion system, 0004 Entry sheet fits its screen.

## Open items

- **Device-verify the orb accessory on build 74 before pressing Release:** strip height/
  `inline` placement when the bar minimizes, `NATIVE_ACCESSORY_CLEARANCE` (56,
  estimated) keeps list bottoms clear, Skia sphere at 34pt, hold-to-talk.

- **PRD #145 device checklist (build 73):** orb Skia render, float, and
  position over the native ＋; speech JA/EN offline; receipt OCR on real JP
  receipts; permission prompts. Swift compiles; web e2e + CI green.
- **PRD #145 calls for the owner:** the orb band costs the Calendar ~164px;
  the "Recaps and nudges" switch gates the Calendar lines but not the orb or
  receipt button; agent-picked rules (repeat suggestions skip payments >45
  days old, day notes need 10+ prior entries, forecast slot always reserved).
- **1.0.1 is live without the real-iPhone check** (native glass bar; ＋ opens
  the Entry sheet *above* the bar; nothing hidden behind it). Check on device.
- **Suito AI on-device checklist** (TestFlight): see PRD #143 testing section
  + the Swift slice checklist in the PR. Model quality, Siri phrases, Spotlight,
  inbox merge, hidden state on non-AI iPhones are untestable on web.
- Privacy gate for the Apple cloud model: does Apple count app → Private Cloud
  Compute requests as data collection? Answer before adding the cloud switch.
- **Analytics API is 403 for the EAS ASC key** (needs Admin role): create an
  ONGOING analytics report request once in ASC (or with an Admin key) to get
  the impressions → page views → downloads funnel. Sales reports need the
  vendor number (ASC > Payments and Financial Reports); not recorded yet.
- After the "Meet Suito AI" event is approved, link it to the nomination.
- Post the launch drafts (`docs/marketing/launch-1.1/checklist.md`) once
  1.1.0 is live; screenshots show the web tab bar, retake on device later.
- Track impressions → page views → downloads in ASC Analytics; baseline is
  pre-2026-10-03 (old listing); ~40 downloads as of 2026-11-06.

## Environment gotchas

- WSL has 7 GB RAM: run jest with `--maxWorkers=1`/`2` and Playwright with
  `--workers=1`; default jest workers crashed WSL. Jest ignores `.claude/`
  (agent worktrees).
- e2e `toHaveScreenshot` tolerance (1%) hides text changes, and plain
  `--update-snapshots` only rewrites failures: use `--update-snapshots=all`.
- The Mac build server (`192.168.50.175`) is a 2012 dual-core i5. Builds take
  20–75 min. Spotlight indexing a fresh repo copy can push load past 200 and
  time out fastlane. Run builds with `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=120`.
- The iOS 26.3 simulator on the Mac won't reliably foreground apps
  (`simctl launch`/`openurl` hang, Maestro driver times out). Verify on device
  through TestFlight instead.
- Web can't show native iOS UI or Yoga-only layout bugs.
