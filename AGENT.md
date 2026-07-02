# AGENT.md — Kaji build & run

Minimal iOS-style personal money-in/out tracker. Expo (React Native) + TypeScript.
Local-first (AsyncStorage). See `docs/build-decisions.md` for the authoritative
scope/UX/design decisions and `fix_plan.md` for the staged task list.

## Environment (required)

**Node 20.** System Node (18.x) is too old for current Expo tooling
(`ReferenceError: File is not defined`). Node 20 LTS is installed via nvm. Source it
before any `node` / `npm` / `expo` command:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use 20
```

## Install

```bash
npm install
```

## Run (web-first validation)

```bash
npm run web        # expo start --web  → shareable localhost URL
npm start          # dev server (choose platform)
npm run ios        # requires the Expo pipeline / device
npm run android
```

## Typecheck

```bash
npx tsc --noEmit
```

## Layout

```
theme/     design system — tokens, ThemeProvider, fonts, Txt helper
docs/      build-decisions.md (source of truth), design references
App.tsx    root: loads fonts, mounts ThemeProvider
```

## Conventions

- Two font families only: **system sans** (leave `fontFamily` unset) for UI copy;
  **JetBrains Mono** for every number and uppercase micro-label (the signature).
- Colors, type scale, and metrics come from `theme/tokens.ts` — do not hardcode hex.
- Rebuild the design with `View`/`Text`/`Pressable` + `StyleSheet`; do **not** port the
  design bundle's HTML/CSS.
