# Repeat management

## User flow

- Settings always shows a **Repeats** drill-in row and the number of active repeat segments.
- Repeats opens as a replacement sheet, like Budgets. **Done** returns to Settings.
- The list contains only segments that can produce an occurrence today or later, ordered by their next displayed occurrence.
- Each row shows the saved note (or category when the note is blank), signed amount, cadence, next displayed date, and any future cutoff.
- Tapping a row opens the existing Entry editor. Saving, stopping, or closing the editor returns to Repeats.
- Repeat creation remains in the normal Entry flow. The empty state explains where to create one.
- The management editor offers daily, monthly, and yearly cadence only. It uses an explicit, confirmed **Stop repeat** action instead of “Never.”

## Editing rules

- Changes start at the next occurrence, including an occurrence displayed today. Past projections remain unchanged.
- A cadence change anchors to the occurrence's scheduled date, not a date moved by weekend handling.
- An unchanged cadence carries future exceptions into the replacement segment. A changed cadence clears them because their scheduled dates no longer describe the new cadence.
- A repeat whose category was removed still displays its saved category in the list. The editor requires a current category before it can save changes.

## Edge cases

- Persisted rules may be split into an ending segment and a later replacement. Every segment that can still produce a future occurrence appears as its own row because persisted rules have no lineage connecting them.
- The Settings count is therefore the number of visible active segments, not a reconstructed count of conceptual series.
- A bounded segment displays its exclusive cutoff. Editing it must copy that cutoff to its replacement so it cannot overlap a later segment.
- Stopping a bounded segment stops it from its next occurrence without changing any separate later segment.
- Ended segments remain persisted for historical projections but are hidden from repeat management.
- Exceptions and exclusive cutoffs are considered when finding the next occurrence.
- For monthly and yearly repeats moved before a weekend, a scheduled occurrence whose displayed date is already before today is skipped. “Next” always means the next date the user will see on the calendar.
- Weekend movement changes only the displayed date; it never changes the cadence anchor.
