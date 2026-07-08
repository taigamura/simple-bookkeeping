# Kaji (家計)

A minimal, iOS-style personal money-in/out tracker. Log daily income and
expenses against a calendar, see monthly totals and category breakdowns, and
import transaction history from Zaim (CSV). No accounts/wallets, no budgets,
no sync — a small, finished app rather than a feature-rich one. Built with
Expo (React Native) + TypeScript, local-first (AsyncStorage), dark by
default.

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
```

Tests live alongside the code they cover (`*.test.ts` / `*.test.tsx`) across
`domain/`, `store/`, `nav/`, `ui/`, and `screens/`. Run both `npm test` and
`npm run typecheck` before considering a change complete — the design
fidelity work in particular has to keep both green.

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
- `screens/` — the four screens/sheets: Calendar, Summary, New Entry,
  Settings.
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

### Shipping plan (status as of 2026-07-04)

All code-side items from [`docs/appstore-readiness.md`](docs/appstore-readiness.md)
are done (Premium/ad surfaces stripped, CSV export, corrupt-load safety
net, JP/EN localization, haptics, Face ID lock, Sentry, splash screen).
Apple Developer enrollment is paid and awaiting approval. Remaining steps,
in order:

**While Apple enrollment is pending (typically 24–48h):**

1. **EAS build configuration** — the last unchecked code item:
   - Create a free [Expo account](https://expo.dev), then `npx eas-cli init`
     and `npx eas-cli build:configure`; commit `eas.json`.
   - Add to `app.json`: `ios.bundleIdentifier` (permanent once shipped —
     choose carefully), `ios.buildNumber: "1"`, and `android.package` for
     later.
   - Add `ios.config.usesNonExemptEncryption: false` — the app makes no
     custom encrypted connections; this skips the export-compliance
     question on every TestFlight upload.
   - Bump `version` to `1.0.0` for the submission.
2. **Write and host the privacy policy.** The easy case ("all data stays
   on device; nothing is collected") with one decision: Sentry is inert
   until a DSN is supplied — ship v1 with it off for a pure "Data Not
   Collected" label, or on (then the policy must mention crash data). Off
   is simpler for v1. A GitHub Pages page in this repo works as the
   hosted URL.

   > While Sentry is off, `eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD=true`
   > on every build profile. The `@sentry/react-native/expo` config plugin
   > adds an Xcode build phase that runs `sentry-cli` to upload source maps,
   > and it fails the build without a Sentry org/project and
   > `SENTRY_AUTH_TOKEN`. When you enable Sentry, set those up (add the token
   > as an EAS secret) and remove the flag so symbolicated stack traces work.

**Once Apple approves the account:**

3. **Accept agreements** at
   [App Store Connect](https://appstoreconnect.apple.com) (Business →
   Paid/Free Apps). Builds can't be submitted until these are accepted.
4. **First iOS build:** `npx eas-cli build --platform ios`. Let EAS log
   into
   the Apple account when prompted — it creates the signing certificate,
   provisioning profile, and bundle ID registration automatically (no
   manual Xcode certificate work).
5. **Create the app record + upload to TestFlight:**
   `npx eas-cli submit --platform ios` — it can create the App Store
   Connect
   app record (this is where the name "Kaji" is claimed; have a fallback
   name ready). Add yourself as an internal tester in TestFlight and
   install on a real iPhone.
6. **Native validation on device** (non-negotiable per the readiness
   doc): exercise the risky areas — RN `Modal` bottom sheets, safe-area
   insets, document picker + Shift-JIS Zaim import, keypad/keyboard
   interaction — plus the features that have only run in dev: Face ID
   lock, haptics, JP/EN locale switching, CSV export share sheet. Fix
   what breaks, rebuild, re-test.

**Then the listing and submission:**

7. **App Store Connect listing:** description, subtitle, keywords,
   category (Finance), age rating questionnaire, privacy policy URL, and
   privacy nutrition labels ("Data Not Collected" if Sentry stays off).
   Do both Japanese and English listings — Japan is the real market.
8. **Screenshots:** at least one 6.9" (iPhone 16 Pro Max class) set;
   simulator captures are fine. JP and EN sets to match the listings.
9. **Submit for review.** First reviews typically take 1–3 days. The
   common first-app rejection causes (fake ads, fake premium toggle) are
   already defused; the remaining risk is reviewer confusion — use the
   review notes field to say it's a fully local app with no accounts, and
   mention the Zaim CSV import so they don't hunt for a login.
