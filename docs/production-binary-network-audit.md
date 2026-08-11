# Production-Binary Network Audit

Run this audit on the exact signed production candidate before App Store
submission. This is a runbook, not evidence that an audit has already run.

## Setup

1. Use a fresh install on two physical iPhones on an isolated test network.
2. Capture device traffic with a tool that can distinguish LAN/local peer
   connections from public destinations. Record the app build number, commit,
   test time, and capture method.
3. Keep the phones unpaired for the baseline journey. Then pair the two phones
   and keep both apps foregrounded and nearby for the transfer journey.

## Baseline journey

On one unpaired phone, cold launch; create, edit, and delete entries; navigate
Calendar and Summary; open Settings and Budgets; change theme; import a local
CSV; export through the system share sheet; delete all data; and relaunch.

Expected result: no public internet or backend traffic attributable to the
app. System-owned file-picker and share-sheet activity must be separately
identified rather than attributed to the app without evidence.

## Paired nearby-transfer journey

With both paired phones foregrounded and nearby, make a change on one phone
and initiate nearby sharing. Expected app traffic is encrypted local peer
discovery and transfer between the two paired devices only. Record the peer
addresses, protocol, timestamps, and that the transfer stops when either app
is backgrounded, unpaired, or no peer is nearby.

## Fail conditions and sign-off

Fail the audit for any app-attributable public internet, cloud/backend,
analytics, telemetry, advertising, or crash-reporting connection. Also fail if
nearby transfer occurs without pairing or continues as background/remote sync.
Attach the capture summary to the release record. Only after review may the App
Store privacy label be finalized; do not infer it from this document alone.
