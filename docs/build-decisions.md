# Kaji — Build Decisions (v1)

Working name **Kaji**. A minimal iOS-style personal money-in/out tracker built with
Expo (React Native) + TypeScript. This document is the durable record of decisions made
in the grilling session so a clean session can resume implementation without
re-litigating foundations.

## Sources of truth

- **Kaji design concept** — a Claude Design project (`claude.ai/design`), project id
  `bab40e17-b306-4a78-9631-8f96db27d44f`. Files: `Bookkeeping App.dc.html` (full working
  prototype logic), `Bookkeeping UI Spec.dc.html` (tokens/type/metrics/components/screens),
  `ios-frame.jsx` (prototype device chrome — **not** part of the app). This is the
  **authoritative reference for scope and UX**.
- **`initial-spec.md`** (repo root) — supplies only the **locked stack/foundation**
  decisions (Expo + RN + TS, local-first storage, web-first validation, EAS pipeline).

**Governing principle (user-stated): when the design concept and `initial-spec.md`
conflict, the design wins** — the design is considerably more polished than the spec.
Treat the design bundle as **visual/design-intent reference, not code to port**. Rebuild
with `View`/`Text`/`Pressable` + `StyleSheet`, CSS→Flexbox. Do **not** port the HTML/CSS
or the prototype's `{{ }}`/`sc-for`/`sc-if` template.

## Current-status amendments (2026-07-13)

This file preserves the original design decisions, but later release-readiness
work superseded several implementation details:

- Navigation remains bespoke, but sheets now use one controlled
  `@gorhom/bottom-sheet` modal host rather than separate React Native `Modal`
  instances. Entry, Settings, and Budgets swap bodies inside that host.
- The static sponsored cards, user-facing Premium toggle, legacy `premium`
  state field, and unused `AdCard` component were removed from V1. Legacy
  persisted blobs that still contain `premium` load normally; the field is
  ignored and omitted from subsequent saves.
- Persisted state now also includes lock preference, budgets, budget mode,
  total budget, and launch destination. CSV export, corrupt-blob recovery,
  JP/EN localization, haptics, and device authentication are implemented.
- EAS configuration, bundle identifiers, splash configuration, a hosted
  bilingual privacy policy, and real-iPhone validation now exist. Remaining
  public-release work is tracked in `docs/appstore-readiness.md` and the public
  V1 PRD.

Where an amendment conflicts with the original locked table or screen text
below, the amendment describes the current product.

## Locked decisions (grill results)

| # | Decision | Detail |
|---|----------|--------|
| 1 | **No accounts/wallets** | Match the design (pure daily in/out). `Transaction` keeps an unused optional `accountId?` so accounts can be added later additively. Overrides `initial-spec.md` §3/§5. |
| 2 | **Persistent recurrence rules** | Entry and edit sheets offer Repeat (Never/Every day/Every month/Every year) plus weekend handling. Rules are unbounded from the selected date and occurrences are projected on demand. Editing applies to the selected occurrence and future instances; deletion offers one occurrence or this-and-future. Existing materialized repeat data migrates as one-time history because it has no reliable series identity. |
| 3 | **Bespoke navigation** | Root holds `tab: 'calendar'\|'summary'` and `sheet: 'entry'\|'settings'\|null`. Custom bottom bar with center green ＋ FAB that opens the Entry sheet. Sheets via RN `Modal` (`animationType="slide"`, transparent backdrop). No react-navigation / expo-router. |
| 4 | **Persistence: AsyncStorage** | `@react-native-async-storage/async-storage`, whole-state JSON, behind a small store module (swappable for SQLite later). Persist: one-time `entries`, `recurrenceRules`, `expCats`, `incCats`, `theme`, `currency`, lock preference, budgets, budget mode, total budget, and launch destination. Load-on-boot, save-on-change. |
| 5 | **Font: JetBrains Mono (bundled)** | Bundle via `@expo-google-fonts/jetbrains-mono` + `expo-font`, weights 400/500/600/700, for the mono "signature" (every number + uppercase micro-label). System sans (SF/Roboto default) for UI copy. Hold splash until fonts load. |
| 6 | **Icons: `@expo/vector-icons`** | Map each design glyph to its intent (Feather/Ionicons/MaterialCommunity): ＋→plus, ⚙→settings, ‹›→chevrons, ✕→x, ↑↓→arrows, ↻→repeat, ⌫→delete, tabs→calendar + bar-chart, theme→moon/sun. Not literal Unicode (Android tofu risk). |
| 7 | **No ads or Premium in V1** | V1 has no advertising, sponsored placement, purchase, subscription, Premium, or remove-ads surface. Earlier prototype ad/Premium concepts are not product behavior. |
| 8 | **First launch: empty (A+)** | Start with **no transactions**; seed only default categories. Use the designed empty states ("No entries this day. Tap ＋ to add one."). Provide a **"Load sample data"** action in Settings that inserts the 15 July-2026 sample entries for demos. |
| 9 | **Theme: dark default, manual only** | Default dark; two-button Appearance control (Dark / Light); OS appearance ignored (no `useColorScheme`). Choice persists. |
| 10 | **Web = phone-width container** | On web only, center the app in a `maxWidth: 402` full-height rounded container with subtle shadow on a neutral backdrop. Native = full-screen with `SafeAreaView`. **No** faux status bar / dynamic island / home indicator anywhere. |
| 11 | **Currency: symbol-only** | ¥ JPY / $ USD / € EUR / £ GBP swap the symbol + reformat only; **no** FX conversion, no per-entry currency, **integer amounts, no cents**, `en-US` grouping (comma thousands). Keypad is integer-only, leading zeros stripped, 9-digit cap. |

## Design tokens (preserve verbatim)

### Colors — dark (default)
`--bg #0E1116` · `--card #171B22` · `--card2 #1A1F28` · `--card3 #242B35` ·
`--ink #EAEEF3` · `--muted #9AA4B2` · `--dim #6B7480` ·
`--hair rgba(255,255,255,.06)` · `--line rgba(255,255,255,.10)` · `--border rgba(255,255,255,.08)`

### Colors — light
`--bg #EEF1F5` · `--card #FFFFFF` · `--card2 #F4F6F8` · `--card3 #E4E9EE` ·
`--ink #141820` · `--muted #5A6472` · `--dim #98A2AE` ·
`--hair rgba(20,24,31,.07)` · `--line rgba(20,24,31,.12)` · `--border rgba(20,24,31,.08)`

### Accents (shared across themes)
`positive #2BD48A` (income, primary CTAs, selection) · `negative #F0766C` (expense, delete) ·
on-green text/icons use **`#0B0E12`** (near-black), never white.

### Type scale (weight · size · family · tracking)
- Hero amount — 600 · 66/58/46px (shrinks by length) · mono · -.04em
- Summary net — 700 · 40px · mono · -.03em
- Screen title — 700 · 24px · sans · -.02em
- List item / category — 600 · 14.5px · sans
- Secondary / note — 500 · 12px · sans
- Section micro-label — 600 · 10–10.5px · mono · +.14em · UPPERCASE
- Inline amount — 600 · 14px · mono
- Calendar day — 600 · 13px · mono (daily total 600 · 8.5px mono)

Two families only: **system sans** (`-apple-system, system-ui`) for UI copy; **JetBrains Mono**
for every number and uppercase micro-label (the signature).

### Layout & shape metrics
Design frame 402×874 · screen h-padding 20–22 · status offset padding-top 52 (→ SafeArea on
native) · card radius 16–20 · bottom-sheet radius 26 (top only) · pills/chips/avatars 999 ·
keypad key radius 15 · icon tile radius 9–11 · calendar day cell radius 11 / ~46px tall ·
progress bars radius 5–6 / height 7–8 · tab bar height 92 · keypad 3 cols · gap 9 · 52px keys ·
round nav buttons 34×34 · primary CTA height 54 / radius 16 · card shadow (dark) 0 8 24
rgba(0,0,0,.4) · CTA glow 0 8 24 rgba(43,212,138,.26).

## Screens

1. **Calendar (home)** — header (month+year title, ‹ › month nav, ⚙ settings); In/Out/Net
   strip bounded by hairlines; weekday row; 7-col month grid with signed daily net (selected
   day = solid green cell, near-black text); selected-day label + net; that day's entries as
   list rows or empty state; tab bar.
2. **Summary** — header ("Summary" + ⚙) + month subtitle; Net card (large mono net + in/out
   split bar + legend); spending-by-category ranked bars (highest first, scaled to max).
3. **New Entry (＋ sheet)** — grab handle; Expense/Income segmented toggle centered; ✕ close;
   large centered amount + type micro-label; horizontally-scrolling category chips; Note row
   (cycles options); Repeat row (cycles); "If on weekend" row (monthly/yearly only); 3-col
   keypad (1–9, 000, 0, ⌫); full-width primary CTA (disabled until amount>0).
4. **Settings sheet** — grab handle; title + Done; Appearance (Dark/Light); Currency (4-grid);
   Categories (Expense/Income sub-tabs; rows = 2-letter code tile + label + ↑/↓/✕; add field +
   green Add); Load sample data.

## Components (primitives to build)

SegmentedToggle · CategoryChip · Keypad · ListRow · SplitBar · CategoryBar · CalendarGrid /
DayCell · TabBar (+ center FAB) · BottomSheet (controlled bottom-sheet host) ·
IconButton (round 34 nav button).

## Data model & logic

```ts
type TxType = 'income' | 'expense';
type Repeat = 'never' | 'daily' | 'monthly' | 'yearly';
type WeekendShift = 'after' | 'before' | 'off';   // Monday / Friday / keep
interface Transaction {
  id: string; day: number;            // day-of-month within ym
  type: TxType; amount: number;       // integer, minor-unit-less
  category: string; note: string;
  repeat?: Repeat; accountId?: string; // accountId reserved, unused in v1
}
interface RecurrenceRule {
  id: string; start: { y: number; m: number; day: number }; anchorDay: number;
  type: TxType; amount: number; category: string; note: string;
  repeat: Exclude<Repeat, 'never'>; weekendShift: WeekendShift;
  exceptions: string[]; endsBefore?: string;
}
interface Currency { symbol: string; code: string; } // ¥/JPY etc.
```

Aggregation (in-memory JS, mirrors the prototype):
- `monthEntries(ym)` — sample data lives only in July 2026 (`y:2026,m:6`); other months empty
  until the user adds. (With real persistence, filter stored entries by `ym`; the prototype's
  hardcoded July gate becomes: entries store their own year/month — **add `y`/`m` to the model
  at implementation** so persistence spans months.)  ⚠ implementation note below.
- `dayNet(day)`, `income`, `expense`, `net`, category breakdown (expenses, sorted desc, bar
  width scaled to max), in/out split bar proportional to `income+expense`.
- `save()` — parse integer amount; if 0, no-op. Persist a one-time transaction for Never or an
  unbounded recurrence rule for daily/monthly/yearly; project only the requested month. Notes
  fall back to the category when "—". Edits split a rule at the selected scheduled occurrence,
  preserving history while updating this and future occurrences.
- Category ops: add (trim, dedupe), remove (min 1), reorder (↑/↓ swap), per Expense/Income list.
- `code(cat)` = first 2 chars uppercased (list-row icon tile).
- Formatting: `yen(n)` = symbol + `Math.round(n).toLocaleString('en-US')`; `signed(n)` prefixes
  +/− (unicode minus −).

> ⚠ **Implementation note — month spanning.** The prototype hardcodes all data to July 2026.
> For a real persisted app, store `year`+`month` (or an ISO date) on each `Transaction` so
> entries persist across real months instead of a single hardcoded month. This is a
> deliberate, minor divergence from the prototype required by persistence (decision 4); the
> UX is unchanged.

## Environment

- **Node 20 required.** System Node is 18.19.1 (too old for current `create-expo-app`/Expo
  tooling — throws `ReferenceError: File is not defined`). Node 20 LTS was installed via
  **nvm** (`~/.nvm`). Every shell must source nvm first:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20`.
- Expo SDK 57 · React 19 · React Native 0.86 (scaffolded via `create-expo-app` blank-typescript).
- Package manager: npm. Validate with `npx expo start --web`.

## Build order (staged — do not one-shot)

1. **Foundation** — Expo scaffold in repo; install deps (async-storage, expo-font,
   @expo-google-fonts/jetbrains-mono, @expo/vector-icons); rename app to Kaji; blank app runs on web. *(setup phase — this session)*
2. **Design system** — `theme/tokens.ts`, `ThemeProvider`, font loading, mono/sans text helpers.
3. **Data layer** — types, AsyncStorage store, aggregation, recurrence + weekend-shift, seed.
4. **Primitives** — the components listed above.
5. **Screens** — Calendar, Summary, Entry, Settings; wire to store; empty states.
6. **Validate** — run Expo web; confirm flows; iterate on fidelity.

Pause for review at the end of each stage.

## Design fidelity (v0.1) — build vs design gaps

The canonical visual reference is **`docs/v0.1_design.html`** (the imported Claude Design
bundle; unpack the `__bundler/template` script to read the prototype markup + logic). Slices
#2–#8 built to the *decisions text* issue-by-issue and are functionally complete, but the
rendered UI drifted from the design in the ways below. **The design wins** on every point
except where a locked decision says otherwise. This section is the authoritative spec for the
Design Fidelity Pass in `.ralph/fix_plan.md`; each fix must keep `tsc`/tests/web green.

**Locked exceptions (do NOT "fix" back to the prototype):** icons stay `@expo/vector-icons`
Feather glyphs, not the prototype's Unicode (decision 6); the Load-sample-data row stays
(decision 8) — the prototype does not have it; keep it styled consistently with the rest of
Settings. Premium, remove-ads, sponsored, and ad surfaces stay absent from V1.

### Required corrections (target = design)

1. **Calendar day cells** (`ui/DayCell.tsx`) — non-selected cells are **transparent**, not
   `card2`. Only the selected day is a solid green tile (near-black number). Selected-day total
   uses translucent near-black `rgba(11,14,18,.7)`, not solid.
2. **Day-entries list** (`ui/ListRow.tsx`, `screens/CalendarScreen.tsx`) — **category is the
   row title** (sans 600 · 14.5 · ink), **note is the subtitle** (sans 500 · 12 · muted),
   *always both*. Wrap the day's rows in one rounded `card` (radius 18) with hairline dividers
   between rows (no rule above the first, none below the last). Current code inverts title/note
   and shows the subtitle only when they differ, with no card.
3. **Calendar header/strip** (`screens/CalendarScreen.tsx`) — In left / Out center / Net right
   (not all-centered); Net renders in **ink** weight-700 (not sign-tinted). Selected-day label
   includes the weekday: `"Wed, Jul 2"`, not `"Jul 2"`.
4. **Summary net card** (`screens/SummaryScreen.tsx`, `ui/SplitBar.tsx`) — micro-label reads
   **"Net this month"**; the net figure is **always green** per the design (not sign-tinted);
   the card has **no border** (surface only); split-bar track = `--bg`.
5. **Summary category bars** (`ui/CategoryBar.tsx`) — bar fill is **green** (`positive`), track =
   `--card`. Current code fills them red.
6. **Entry type toggle** (`screens/EntrySheet.tsx`) — active Expense/Income segment is **green**
   with near-black text (the shared selection accent), not the grey `card3`/ink it uses now.
7. **Entry option rows** (`screens/EntrySheet.tsx`) — group Note / Repeat / weekend into **one
   card** (radius 14) with hairline dividers. Labels are **sans 13 · dim** (not uppercase mono);
   values are sans 600, dim when at the default else tinted (Repeat turns **green** when set).
   Repeat label shows the ↻. Note presets are **per-type**: expense =
   `['—','Cash','Card','Konbini','Online']`, income = `['—','Bank transfer','Cash','Bonus']`
   (replaces the single flat list). Weekend row: options `Move to Monday / Move to Friday /
   Keep on weekend`, default **Move to Monday**.
8. **Entry CTA** (`screens/EntrySheet.tsx`) — disabled state is a **`card2` fill with dim text**,
   not green-at-40%-opacity. Label is sentence-case: **"Add expense" / "Add income"**.
9. **Settings selection styling** (`screens/SettingsSheet.tsx`) — Appearance and Currency use the
   design's **optBox**: `rgba(43,212,138,.15)` tint + inset green ring + green text when active,
   `card2`/muted when not (radius 12). Not a green-fill pill (Appearance) or a solid-green
   two-line tile (Currency). Currency tiles are **single-line** `"¥ JPY"`.
10. **Settings categories** (`screens/SettingsSheet.tsx`) — the Expense/Income sub-tab is a
    **small pill group aligned right on the "Categories" header row** (`pill()` style), not a
    full-width toggle below the label. Category rows share **one card** with hairline dividers
    (not one grey card per row).
11. **Settings "Done"** (`screens/SettingsSheet.tsx`) — top-right is a green **"Done"** text
    button, not an ✕ icon.
12. **Tab bar** (`nav/TabBar.tsx`) — active tab (icon + label) is **green**, not ink. The ＋ FAB
    is 54×54 with a green glow (`0 8 22 rgba(43,212,138,.32)`). Stretch: make the bar float with
    a gradient fade to `--bg` and let content scroll under it (design behaviour); if deferred,
    at minimum land the green active tint + FAB glow.

### Structural note (lower priority)

The design's Entry and Settings sheets are **tall fixed-height** sheets (`top: 34` / `top: 24`
from the frame top) with a flexible spacer pushing the keypad/CTA to the bottom, rather than the
current content-height bottom-anchored `Modal`. Optional polish — fold into the Entry/Settings
fidelity tasks only if it doesn't destabilise the sheet layout.
