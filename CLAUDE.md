## Agent skills

### Issue tracker

Issues are tracked as GitHub issues via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles map to identically-named labels (`ready-for-agent` and `wontfix` already exist in the repo). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.

## Visual testing is mandatory

Every implementation (feature or fix, not just "visual" tickets) MUST ship with a **browser test** and a **screenshot test**, written as part of the TDD loop (see the `tdd` skill's Visual Gate). Unit tests (jest) have no layout engine, so misplaced UI passes them — e.g. the first Liquid Glass build's tab-bar lens that rode 7px high and drifted right on Summary.

- **Browser test:** a Playwright spec in `e2e/` against the exported web build, red-first, asserting behavior *and* geometry (bounding boxes centred / aligned / on screen). See `e2e/tabbar.spec.ts` for the pattern.
- **Screenshot test:** a `toHaveScreenshot` baseline of each affected state, committed under `e2e/*.spec.ts-snapshots/`. Open and inspect every new/updated PNG before accepting it; never `--update-snapshots` blind.
- **Run:** `npm run e2e:export && npx playwright test` (Chromium runs on this box; Firefox fallback: `npm run e2e:test:firefox`).
- **Native-only effects** (e.g. `expo-glass-effect` on iOS 26) can't render on web. Still pin the layout in the browser, and state in the hand-off what needs on-device verification.
