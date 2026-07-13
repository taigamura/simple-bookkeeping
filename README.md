# Kaji (家計)

A minimal, iOS-style personal money-in/out tracker. Log daily income and
expenses against a calendar, set either a total monthly budget or budgets by
expense category, see monthly totals and category breakdowns, and import or
export transaction history as Zaim-compatible CSV. There are no
accounts/wallets, cloud accounts, or sync — the product is intentionally a
small, local-first app rather than a full personal-finance platform. Built
with Expo (React Native) + TypeScript and dark by default.

See [`initial-spec.md`](initial-spec.md) for the original scope/stack spec
and [`docs/build-decisions.md`](docs/build-decisions.md) for the full set of
design and implementation decisions.

Privacy Policy: https://taigamura.github.io/simple-bookkeeping/privacy.html

## Requirements

- **Node 20.** System Node may be older (18.x throws
  `ReferenceError: File is not defined` under current Expo tooling). Install
  via [nvm](https://github.com/nvm-sh/nvm) and select it per shell:
  ```bash
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
  ```
- npm (package manager for this repo — do not switch to yarn/pnpm).

## Initialization

```bash
npm install
```

## Running

```bash
npm run web       # expo start --web — fastest loop, primary dev target
npm run start      # expo start — Metro bundler, QR code for Expo Go
npm run ios        # expo start --ios (requires macOS/simulator)
npm run android    # expo start --android (requires Android SDK/emulator)
```

Web is the primary validation target during development (see build
decisions doc); native platforms are exercised via Expo Go / EAS builds
before any App Store submission.

> **WSL2 note:** the standalone React Native DevTools debugger can fail with
> a `libnspr4.so` error inside WSL2. This doesn't block the app — web and
> native bundles run fine — only the debugger launcher. Fix:
> `sudo apt-get install -y libnspr4 libnss3`.

## Testing

```bash
npm test          # jest (jest-expo preset)
npm run typecheck # tsc --noEmit
npm run e2e       # Playwright sheet-regression suite (exports the web build, then tests it)
```

Tests live alongside the code they cover (`*.test.ts` / `*.test.tsx`) across
`domain/`, `store/`, `nav/`, `ui/`, and `screens/`. Run both `npm test` and
`npm run typecheck` before considering a change complete — the design
fidelity work in particular has to keep both green.

### Sheet-regression e2e suite

`e2e/` holds a permanent Playwright suite that drives the exported Expo web
build the way a user does — fresh cold page loads, real first taps on ＋ and
⚙, dismiss/reopen sequences, ghost-overlay probes, and sheet-geometry checks.
`npm run e2e` exports the web build and runs it in one step (first time:
`npm run e2e:install -- chromium`); CI (`.github/workflows/ci.yml`) runs it
on every push to main and every PR alongside typecheck and jest.

Chromium is the canonical browser (it's what CI runs). If the browser system
libraries can't be installed (e.g. bare WSL2 without sudo —
`libasound.so.2` missing), use Firefox instead:
`npm run e2e:install -- firefox`, then `npm run e2e:test:firefox` (that
script also skips Playwright's pre-launch host validation, which rejects the
machine even though Firefox loads the audio libs dynamically).

The release contract is straightforward: all canonical Playwright scenarios
must pass without `test.fail()`, retries, skips, or weakened assertions. The
suite currently exposes an unresolved web-only bottom-sheet regression tracked
in GitHub issue #63; a public V1 release requires that issue to be resolved and
the suite to be green in CI.

## Project structure

- `domain/` — pure logic: types, calendar math, recurrence, category
  aggregation, summary, Zaim CSV import, sample data. No React/RN imports.
- `store/` — app state, AsyncStorage persistence, and the schema for
  persisted data.
- `theme/` — design tokens, `ThemeProvider` (dark/light), font loading
  (JetBrains Mono), text helpers.
- `nav/` — bespoke navigation shell: tab state, bottom sheets, tab bar
  (no react-navigation/expo-router).
- `ui/` — presentational primitives (keypad, calendar grid, list rows,
  charts, cards).
- `screens/` — Calendar and Summary screens plus the Entry, Settings, and
  Budgets sheet bodies.
- `docs/` — design reference (`v0.1_design.html`) and the durable
  build-decisions record.

## Deployment

Deployment target is the iOS App Store via [EAS](https://expo.dev/eas)
(Expo's cloud build/submit service), which removes the need for a local Mac.
Web (`npm run web`) is used purely for development validation — it is not
the shipping target.

EAS's free tier covers roughly 15 iOS + 15 Android builds/month, which is
enough for this project's needs; the Apple Developer fee ($99/yr) is the
only unavoidable cost.

### iOS deployment runbook

The Expo project, EAS project ID, bundle identifier, build profiles, splash
screen, and encryption declaration are already configured in `app.json` and
`eas.json`. Run deployment commands from the repository root under Node 20.

1. Log in to Expo if the current machine has no EAS session:

   ```bash
   npx eas-cli login
   ```

2. Build the production iOS binary in EAS:

   ```bash
   npx eas-cli build --platform ios --profile production
   ```

   On the first build, let EAS authenticate with Apple and manage the signing
   certificate and provisioning profile. The production profile increments the
   remote build number automatically.

3. Upload the completed build to App Store Connect/TestFlight:

   ```bash
   npx eas-cli submit --platform ios --profile production
   ```

   `npx eas-cli submit --platform ios` is also valid when selecting the build
   and submit profile interactively. The App Store Connect app record must use
   the final public name; the name is intentionally still undecided.

4. In App Store Connect, wait for processing, add the build to internal
   TestFlight testing, and install that exact candidate on a real iPhone. Run
   the release smoke test from `docs/appstore-readiness.md`.

5. Complete the Japanese and English listing, screenshots, age rating,
   Finance category, privacy answers, privacy-policy/support URLs, export
   compliance, and review notes. Then select the tested build and submit it for
   App Review in App Store Connect.

Any code or release configuration change after the TestFlight smoke test
requires a new production build and a repeat of the affected checks. EAS
Submit uploads a binary to App Store Connect; it does not replace the final
metadata and App Review submission steps there.

While crash reporting remains disabled, every EAS build profile sets
`SENTRY_DISABLE_AUTO_UPLOAD=true`. If Sentry is enabled later, configure its
organization/project and `SENTRY_AUTH_TOKEN`, remove that flag, and update the
privacy policy and App Store privacy answers before shipping.

### V1 release status (2026-07-13)

Core V1 functionality, EAS configuration, the hosted privacy policy, and
real-iPhone testing are complete. The current product name remains a working
name and will be finalized separately before App Store metadata is locked.

The remaining work for a public V1 is tracked in
[`docs/appstore-readiness.md`](docs/appstore-readiness.md) and GitHub issue
[#72](https://github.com/taigamura/simple-bookkeeping/issues/72). In summary:

1. Restore a deterministic, fully green release quality gate, including the
   bottom-sheet Playwright suite and clean unit-test output.
2. Harden the persisted-data boundary and verify CSV backup/restore as a
   release flow.
3. Finalize the product name, version metadata, bilingual App Store listing,
   screenshots, privacy answers, support details, and review notes.
4. Produce one clean EAS release candidate, smoke-test it on a real iPhone,
   then submit that exact build for review.

V1 ships without advertising, purchases, analytics, accounts, or enabled
crash reporting. The Sentry integration remains inert while `sentryDsn` is
blank, and EAS builds disable source-map upload accordingly.
