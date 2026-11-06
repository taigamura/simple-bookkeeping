# Progress

Session handoff (2026-10-23). Long-lived project state lives in
`docs/agents/current-state.md`; this file covers what to do next.

## Current state
- **Suito AI 1.1.0 is on TestFlight.**
  - Built from `feat/suito-ai`: PR #144, open and not merged.
  - Spec: PRD #143 (`docs/prd/suito-ai.md`) and ADR-0006.
  - Not submitted for App Review.
- **1.0.1 is live** with the search-focused listing (`store.config.json`, `npm run listing`).
- **The Mac build server's checkout is on `feat/suito-ai`.** Its local `expo run:ios` script tweak is saved in `stash@{0}`.

## Next steps
1. **Test 1.1.0 on an iPhone.** Use the checklist in PR #144:
   - parse an entry in JA and EN
   - the letter and the nudge
   - Ask with tool lookups
   - Siri phrases
   - Spotlight and its Settings switch
   - inbox merge with no duplicates
   - AI hidden on non-Apple-Intelligence phones
2. **Fix what the device test finds,** then merge PR #144 (CI must pass).
3. **Add AI keywords** (AI家計簿, オフラインAI) to `store.config.json`, then push the listing with the 1.1.0 version.
4. **Submit 1.1.0 for review** using the ASC API flow (see `asc-api-automation` in memory).

## Open questions
- **Apple cloud-model switch:** does Apple count an app's Private Cloud Compute requests as data collection? This blocks the cloud switch (ADR-0006).
- **Japanese localization:** the new `ja.lproj` makes UIKit's system strings Japanese on Japanese devices. Keep it, or gate it?
- **Spotlight tap:** a result opens the app but doesn't jump to that day. Add the deep link?
- **Spotlight default:** it's on by default and Suito has no app lock. Is an app lock needed?
- **ASC Analytics:** compare impressions, page views and downloads before and after the 2026-10-03 listing change.
