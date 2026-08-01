# ADR-0001 — Appearance follows the OS by default

- **Status:** accepted (2026-07-31)
- **Supersedes:** build decision 9 ("Theme: dark default, manual only")

## Context

Build decision 9 pinned Kaji to dark by default and deliberately ignored OS
appearance: no `useColorScheme`, a two-button Dark/Light control, and the choice
persisted. That made sense while the product had a single dark-first design.

The Kippu visual direction (ADR-0002) is designed light-first. Keeping dark as
the launch default would have meant most users never saw the direction we chose,
while flipping the default to light would have been just as arbitrary in the
other direction — and would have overridden the preference of every user whose
device is set to dark.

## Decision

The persisted `theme` field becomes a **`ThemePreference`** — `'system' |
'light' | 'dark'` — defaulting to `'system'`. `ThemeProvider` resolves it to a
concrete `ThemeMode` (`'light' | 'dark'`), consulting `useColorScheme()` only in
the `'system'` case and re-resolving live when the device flips.

The provider exposes both: `preference` (what the user chose, what Settings
highlights) and `mode` (what is actually rendered). Keeping them distinct is the
point — `System` must stay selected in Settings regardless of which way the OS
currently leans.

`app.json` moves to `userInterfaceStyle: "automatic"`, and the splash gains a
`dark` variant so the launch screen doesn't flash light on a dark device.

## Consequences

- Existing persisted blobs hold `'dark'` or `'light'`. Those are still valid
  `ThemePreference` values, so they load unchanged and those users keep the
  appearance they picked. No migration, no schema version bump.
- Only users with no persisted preference — new installs — get `system`.
- `toggle()` still exists and now *pins*: from `system` it selects the opposite
  of whatever the OS is currently giving.
- Every colour must work in both modes, because the app can now change
  appearance underneath a running session. This is what forced accents out of a
  shared constant and into the per-mode palette (ADR-0002).

## Alternatives considered

- **Light default, still manual.** Simpler, but silently overrides the device
  preference of every dark-mode user, and we'd have had to pick a default we
  couldn't justify.
- **Keep dark default.** The chosen direction is a light design; defaulting to
  dark would mean shipping a face almost nobody sees.
