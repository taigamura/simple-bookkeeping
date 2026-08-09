/**
 * Playwright e2e config (#58) — the repo's permanent sheet-regression suite.
 *
 * Runs against the exported Expo web build (`npm run e2e:export` →
 * e2e/.web-build) served by the zero-dependency static server in
 * e2e/serve.mjs. `npm run e2e` does export + test in one step.
 *
 * The suite began under a red-first contract: scenarios reproducing real,
 * shipping Build 7 bugs (#60/#61/#62) were marked `test.fail()` so CI stayed
 * green only while the bug existed. Those three are fixed and closed, so every
 * marker has been flipped to a plain passing test and no `test.fail()`,
 * `test.skip()`, or probe-only spec remains — the release gate requires the
 * whole suite to pass on its own terms. Deleting or skipping these tests is
 * treated like deleting the unit suite: never do it. See e2e/sheets.spec.ts.
 *
 * `retries` stays 0 on purpose: sheet-open failures are probabilistic, and a
 * retry pass would let a genuinely-red scenario flicker into green. The specs
 * make failures deterministic by repetition instead.
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
    // In the WSL/Linux agent environment, an unopened IPv4 loopback socket can
    // take minutes to reject a probe. The IPv6 loopback rejects immediately,
    // so Playwright can start the configured web server without a false stall.
    baseURL: 'http://[::1]:4173',
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
    url: 'http://[::1]:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
