# Kaji — Fix / Build Plan

Task tracker for the Ralph loop. Derived from the staged build order in
`docs/build-decisions.md` (the authoritative scope/UX record). **One stage per loop.**
Pause for review at the end of each stage.

## Legend
- [x] done  ·  [~] in progress  ·  [ ] todo

## Stages

- [x] **1. Foundation** — Expo scaffold, deps installed, app renamed to Kaji, runs on web.
      (commit `e37dba5`)
- [x] **2. Design system** — `theme/tokens.ts`, `ThemeProvider`, font loading (JetBrains
      Mono), mono/sans text helpers. (typecheck clean; validated via `theme/ThemePreview`)
  - [x] `theme/tokens.ts` — dark + light color tokens, accents, type scale, layout metrics.
  - [x] `theme/ThemeProvider.tsx` — context, dark default, manual `setMode`/`toggle`.
  - [x] `theme/useAppFonts.ts` — JetBrains Mono 400/500/600/700 loading hook.
  - [x] `theme/Txt.tsx` — themed Text with typography variants + tone.
  - [x] Wire `App.tsx`: load fonts (hold render until ready) + ThemeProvider.
  - [ ] Theme choice persistence — deferred to Stage 3 (needs AsyncStorage store).
- [ ] **3. Data layer** — types, AsyncStorage store (whole-state JSON, load-on-boot /
      save-on-change), aggregation, recurrence + weekend-shift, default-category seed.
      Also wire theme/currency/premium persistence here. Add `y`/`m` to `Transaction`
      (month-spanning divergence — see build-decisions "Implementation note").
- [ ] **4. Primitives** — SegmentedToggle, CategoryChip, Keypad, ListRow, SplitBar,
      CategoryBar, CalendarGrid/DayCell, TabBar (+ center FAB), BottomSheet, AdCard,
      IconButton.
- [ ] **5. Screens** — Calendar, Summary, Entry sheet, Settings sheet; wire to store;
      empty states; ad slots gated by `premium`; web phone-width container (decision 10).
- [ ] **6. Validate** — run Expo web, confirm flows, iterate on fidelity.

## Learnings / notes
- Node 20 required (system Node 18 too old). Source nvm before any node/expo command:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20`. See `AGENT.md`.
- Font export names: `JetBrainsMono_400Regular` / `_500Medium` / `_600SemiBold` /
  `_700Bold` (each RN weight is its own `fontFamily` string).
- RN `letterSpacing` is absolute px, not `em` — tokens pre-convert the design's em tracking
  to px at each size.
- Sans = system default (leave `fontFamily` unset); only mono needs explicit families.
