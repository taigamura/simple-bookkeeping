# Ralph Fix Plan (queue item)

## Current Task

Queue is empty. All six queued issues (#39, #40, #41, #43, #44, #45) are
implemented, committed, and closed on GitHub; queue.json was stale (still
showing #43 as "processing" and #41/#44/#45 as "pending") and has been
reconciled to "completed" to match reality.

The only remaining `ready-for-agent` issue is #31, the parent "Device polish"
tracking issue — every sub-task it lists is done. Its one open thread is the
App Store display name rename (#42, closed as a placeholder): `app.json`
still has `"name": "Kaji — RENAME BEFORE SUBMIT (#42)"` pending the actual
name from the app owner. This needs human input, not further agent work —
do not guess a name.

## Next steps

- No actionable `ready-for-agent` work remains. Wait for new issues to be
  labeled, or for the owner to supply the App Store display name so #42's
  placeholder can be replaced.
