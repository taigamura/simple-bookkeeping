# Entry edit + delete flow (tap day-list row to edit/delete)

> GitHub issue #43 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/43

## Parent

#31 — Device polish: calendar grid, bottom-edge layout, gesture sheets, entry edit/delete, month swipe

## What to build

Give the user a way to **edit or delete** an existing entry — currently there is no way to fix or remove a mistaken transaction, so this slice also closes the app's only delete path.

Make each day-list row pressable. Tapping a row opens the **same sheet as ＋**, in **edit mode**, prefilled from the tapped transaction (type, amount, category, note). Because each transaction is standalone (recurrence materializes into independent entries with no sibling link), edit mode operates on a **single occurrence** and **hides the Repeat and weekend-shift rows** — those stay create-only. Saving **overwrites the entry by `id`**, preserving its `id`/`y`/`m`/`day` (no duplicate). A **Delete** action removes it, guarded by a **native confirm dialog** (reusing the existing confirmation pattern that already falls back to `window.confirm` on web). After save or delete, return to the Calendar with the relevant day selected.

Domain logic lives in two new **pure** helpers alongside `makeEntry` — `updateEntry(entries, id, draft)` and `removeEntry(entries, id)` — mirroring the existing `addCategory`/`removeCategory` shape; persistence continues through the store's whole-state `update({ entries })` path. The Entry sheet gains an optional `editing` entry and an `onDelete` callback; the sheet host's state must carry **which** entry is being edited, not just a sheet-type enum.

Changing an entry's date/day from the edit sheet is **out of scope** (the ＋ sheet has no date picker; day comes from the calendar selection). All new controls and confirmation copy must be localized in Japanese.

## Acceptance criteria

- [ ] Pure `updateEntry(entries, id, draft)` and `removeEntry(entries, id)` exist alongside `makeEntry`, return new arrays, never mutate input; update overwrites the matching entry's fields while preserving `id`/`y`/`m`/`day`, update/remove of a missing id is a no-op, remove drops exactly the matching entry (exhaustively unit-tested)
- [ ] Day-list rows are pressable and fire an edit callback with the correct entry
- [ ] Tapping a row opens the Entry sheet in edit mode, prefilled with the entry's type, amount, category, and note
- [ ] Edit mode hides the Repeat and weekend-shift rows and shows a "Save"-style CTA
- [ ] Saving overwrites the same entry by `id` (no duplicate); a Delete action is present
- [ ] Delete asks for confirmation first via the native confirm dialog (with web `window.confirm` fallback)
- [ ] After save or delete, the app returns to the Calendar with the relevant day selected
- [ ] All new labels and confirmation copy resolve from the `ja` dictionary
- [ ] Component tests cover edit-mode prefill / hidden recurrence rows / Delete-fires-onDelete and the day-list tap wiring

## Blocked by

- #39

