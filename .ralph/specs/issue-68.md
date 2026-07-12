# Open-to setting (Calendar or Entry) on launch

> GitHub issue #68 | Labels: ready-for-agent, P2 | https://github.com/taigamura/simple-bookkeeping/issues/68

## Parent

#64

## What to build

A setting to choose what the app **opens to** on launch: the **Calendar** (today's behavior) or a new-**Entry** sheet. A Calendar/Entry option group in Settings, styled like the existing Appearance and Currency tiles, bound to a persisted `openTo` preference (default `'calendar'`).

The nav host seeds its initial sheet state from `openTo`: when `'entry'`, launch starts on the Calendar tab with the Entry sheet auto-presented in create mode for today; closing that sheet reveals the normal Calendar. When `'calendar'`, launch is unchanged. This is a **cold-launch behavior only** — it does not re-trigger when navigating back to the Calendar within a session.

Schema: add `openTo: 'calendar' | 'entry'` (default `'calendar'`) to the persisted whole-state blob, backward-compatible via the existing merge-by-known-keys load (no version bump).

## Acceptance criteria

- [ ] Settings shows a Calendar / Entry option group reflecting the current `openTo` value and firing a callback on change
- [ ] `openTo` persists and survives reload; an older blob without it falls back to `'calendar'`
- [ ] With `openTo = 'entry'`, a cold launch auto-presents the Entry sheet (create mode, today) over the Calendar
- [ ] Closing the launch Entry sheet reveals the normal Calendar
- [ ] With `openTo = 'calendar'`, launch is unchanged
- [ ] Open-to does not re-trigger on in-session navigation back to the Calendar
- [ ] Settings component test covers the option group; nav host test covers the auto-present on mount

## Blocked by

None - can start immediately

