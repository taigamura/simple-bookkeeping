# Current state (injected at session start)

Short, living summary of where the project is. It's injected into every new
Claude session by `.claude/hooks/session-context.sh`. **Update it in the same
change whenever a release ships, a decision lands, or an open item closes.**
Keep it under ~60 lines; durable reasoning belongs in `docs/adr/`.

_Last updated: 2026-10-23_

## Release

- App: **Suito** (bundle `com.taigamura.kaji`; ASC listing name is "Suito",
  verified via API 2026-10-03). Version **1.0 is live** on the App Store.
- **1.0.1 (build 69, native tab bar + new search-focused listing) is live**
  (READY_FOR_SALE, checked 2026-10-07). 0 ratings. Next change = new version.
- **1.1.0 (Suito AI) is on TestFlight** (2026-10-23): ipa
  `build-1792725518761.ipa` built on the Mac from `feat/suito-ai` (PR #144,
  not merged), EAS submission `e67b1bbc`. Not submitted for review.
- Ship with `/ship-ios` (config: `.claude/ship.json`).

## Recent decisions

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
  near zero. Name/subtitle/keywords/description only change on an editable
  version; promo text can change on the live one.

- **iOS tab bar = system `UITabBar`** (ADR-0005, PR #142). The ＋ is a
  separate glass circle. Web/Android keep the custom `TabBar`. Don't go back to
  faking Liquid Glass; if native doesn't satisfy, revert to the flat bar.
- **Browser + screenshot testing is mandatory** for every implementation
  (CLAUDE.md "Visual testing is mandatory"). Pattern: `e2e/tabbar.spec.ts`.
- Earlier ADRs: 0001 follow OS appearance, 0002 Kippu visual direction,
  0003 motion system, 0004 Entry sheet fits its screen.

## Open items

- **1.0.1 is live without the real-iPhone check** (native glass bar; ＋ opens
  the Entry sheet *above* the bar; nothing hidden behind it). Check on device.
- **Suito AI on-device checklist** (TestFlight): see PRD #143 testing section
  + the Swift slice checklist in the PR. Model quality, Siri phrases, Spotlight,
  inbox merge, hidden state on non-AI iPhones are untestable on web.
- Privacy gate for the Apple cloud model: does Apple count app → Private Cloud
  Compute requests as data collection? Answer before adding the cloud switch.
- Listing: add AI keywords (AI家計簿, オフラインAI) to `store.config.json`
  before submitting 1.1.0 for review.
- Track impressions → page views → downloads in ASC Analytics; baseline is
  pre-2026-10-03 (old listing).

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
