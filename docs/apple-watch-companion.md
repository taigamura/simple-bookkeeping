# Apple Watch expense companion

This is a generated, development-only watchOS companion scaffold. It supports
expense amount entry, a small list of recent categories, an explicit Save
action, and the current allowance payload. It intentionally does not expose
income, notes, recurrence, or date editing.

It is opt-in: `KAJI_ENABLE_WATCH_EXPENSE=1` enables the Expo config plugin.
The `development` and `preview` EAS profiles set that flag; `production` does
not, so release archives do not embed the uncertified Watch app. Do not enable
it for production until the certification gate below has been completed.

Saving creates a versioned `source: watch` quick-entry command with a UUID.
The Watch keeps that command locally and retries it through WatchConnectivity
until the paired iPhone returns the exact `watch:<UUID>` acknowledgement. The
iPhone bridge writes accepted commands atomically to the existing App Group
inbox, then acknowledges them. The React Native app remains the only ledger
writer and deduplicates retries by command identity.

The complication reads the same read-only `quick-entry-snapshot.json`
allowance payload as the existing iPhone widget and opens Watch expense entry.

## Human certification gate

This scaffold is not production-ready and has not been certified on a real
Apple Watch. Before release, a human must verify pairing, offline retries,
acknowledgement after iPhone relaunch, complication updates, accessibility,
and the generated Xcode targets on physical hardware.
