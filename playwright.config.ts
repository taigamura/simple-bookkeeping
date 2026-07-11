/**
 * Playwright e2e config (#58) — the repo's permanent sheet-regression suite.
 *
 * Runs against the exported Expo web build (`npm run e2e:export` →
 * e2e/.web-build) served by the zero-dependency static server in
 * e2e/serve.mjs. `npm run e2e` does export + test in one step.
 *
 * RED-FIRST CONTRACT: parts of e2e/sheets.spec.ts are marked `test.fail()`
 * because they reproduce real, currently-shipping Build 7 bugs (#60/#61/#62).
 * They keep CI green *only while the bug exists*; the fix flips each marker to
 * a plain passing test. Removing or skipping these tests is treated like
 * deleting the unit suite — never do it. See e2e/sheets.spec.ts.
 *
 * `retries` stays 0 on purpose: the Build 7 failures are probabilistic, and a
 * retry pass would let a genuinely-red scenario flicker into "expected to fail
 * but passed". The specs make failures deterministic by repetition instead.
 */
import { defineConfig, devices } from '@playwright/test';

// Chromium is the canonical browser (it's what CI runs). E2E_BROWSER=firefox
// is an escape hatch for machines where browser system libraries (e.g.
// libasound2 on a bare WSL2 without sudo) can't be installed — Firefox loads
// audio libs dynamically, but Playwright's pre-launch host validation still
// rejects the machine, so the `e2e:test:firefox` script also sets
// PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS. Install with
// `npm run e2e:install -- firefox`.
const BROWSER = process.env.E2E_BROWSER === 'firefox' ? 'Desktop Firefox' : 'Desktop Chrome';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Cold-load scenarios repeat full page loads inside one test; give them room.
  timeout: 180_000,
  retries: 0,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    ...devices[BROWSER],
    baseURL: 'http://localhost:4173',
    // Phone-shaped viewport: the web AppShell centers a maxWidth-402 frame
    // (24px backdrop padding), so 430 wide renders the app at full phone width.
    viewport: { width: 430, height: 932 },
    // The app picks ja/en off navigator.language; pin it so the label-based
    // selectors (aria-labels from i18n/strings.ts) are stable.
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
