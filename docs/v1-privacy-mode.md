# V1 Privacy Mode

Status date: 2026-07-13.

V1 is a zero-data-collection build. The app stores user-entered transactions,
categories, budgets, settings, and corrupt-load recovery backups in local app
storage. It has no account, backend, internet service, cloud or remote sync,
advertising, analytics, purchase, subscription, Premium, or crash-reporting
surface. Authenticated nearby peer-to-peer household transfer between paired
phones while both apps are open is the only networking capability. It is local
peer traffic, not an internet service, and must not be described as zero
networking or no transmission.

## Runtime and Release Configuration

- No crash-reporting, analytics, or telemetry SDK is installed, configured, or
  initialized.
- `npm run privacy:check` rejects public-internet-capable imports,
  browser/network APIs, and telemetry configuration in app code. Native nearby
  transfer is contained in `platform/nearbyNativeTransport.ts` and the
  `modules/kaji-nearby/` bridge.

## Legacy Premium Compatibility

Older same-version persisted envelopes may contain a `premium` boolean. V1 no
longer includes that field in `AppState`, `DEFAULT_STATE`, or saved envelopes.
The loader treats it as an unknown legacy field, ignores it, and still accepts
the rest of a valid persisted envelope.

## Production-Build Network Audit

Run the release-candidate audit in
[`production-binary-network-audit.md`](production-binary-network-audit.md).
It permits only expected encrypted local peer traffic during an explicit paired
transfer and forbids public internet/backend traffic throughout the journey.

## App Store Privacy Answers

The intended answer is “Data Not Collected,” because the app does not collect
data from the user or send it to a developer or third party. This is an App
Store submission assumption, not a completed declaration: verify the exact
production binary, nearby-transfer implementation, and current App Store
Connect definitions before submission. Do not guess privacy labels. The
privacy-policy text in `docs/privacy.html` describes the same behavior in
English and Japanese.
