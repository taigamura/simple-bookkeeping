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

High-level pipeline (see `initial-spec.md` §1.3):

1. Enroll in the Apple Developer Program ($99/yr) — required before any
   App Store submission or TestFlight distribution.
2. `eas build --platform ios` — produces a signed iOS binary in Expo's
   cloud (no local Xcode/Mac needed).
3. `eas submit --platform ios` — uploads the build to App Store Connect.
4. Distribute via TestFlight for real-device testing before public release.
5. Complete App Store Connect metadata (privacy nutrition label, age
   rating, screenshots, description) and submit for review.

EAS's free tier covers roughly 15 iOS + 15 Android builds/month, which is
enough for this project's needs; the Apple Developer fee is the only
unavoidable cost, and only once going native.
