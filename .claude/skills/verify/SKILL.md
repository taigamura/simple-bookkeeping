---
name: verify
description: Verify a change by driving the running app — dev web via expo start + Playwright Firefox on this WSL2 machine.
---

# Verifying changes in this repo

The app is an Expo (React Native) app. The verification surface that matters
most is **dev web** (`expo start --web`) — react-native-web's DEV build has
runtime guards (e.g. `StyleSheet.compose` arg-count throw) that are compiled
out of the production export the e2e suite uses, so dev-only crashes are
invisible to `npm run e2e`.

## Launch (dev web)

```bash
CI=1 EXPO_NO_TELEMETRY=1 npx expo start --web --port 8090   # run in background
# ready when: curl -s -o /dev/null -w "%{http_code}" http://localhost:8090 → 200
```

## Drive (Playwright)

- **Chromium does NOT launch here** (bare WSL2, no `libasound.so.2`, no sudo).
  Use Firefox with the repo's ALSA stub:
  ```bash
  PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true \
  LD_LIBRARY_PATH=$PWD/e2e/.alsa-stub \
  node <driver>.mjs
  ```
  (The stub is built by `npm run e2e:test:firefox`; e2e/run-firefox.mjs
  documents it.)
- An ESM driver script must live **inside the repo** so `@playwright/test`
  resolves — node resolves imports from the script's path, not cwd.
- Reuse the selectors from `e2e/app.ts`: FAB = `getByLabel('Add entry')`,
  gear = `getByLabel('Settings')`, sheets = testIDs `entry-sheet` /
  `settings-sheet` / `budgets-sheet`, days = `getByLabel('Day N')`.
- Tap by coordinates (`page.mouse.click` at boundingBox center) like
  `e2e/app.ts` does — locator `.click()` gets intercepted by sheet overlays.
- **Playwright "visible" ≠ on screen** for sheets: the content view is in the
  DOM while translated below the viewport. Assert geometry like
  `expectSheetOpen` does (`box.y >= 0 && box.y + box.height <= viewport.height`),
  and wait ~1s for the present animation before screenshots.

## e2e suite (prod export)

`npm run e2e` = export + Playwright against the static prod build.
On this machine use `npm run e2e:export` then `npm run e2e:test:firefox`.

Gotcha (as of 2026-07-12): the suite is fully red on main for a
pre-existing reason — after any sheet dismissal, no sheet reopens (prod
probe shows a lingering "Bottom sheet backdrop" button intercepting
pointer events). Don't attribute those failures to your change; baseline
first (`git stash push <src-file>` → re-export → run one test → pop).
