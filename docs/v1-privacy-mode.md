# V1 Privacy Mode

Status date: 2026-07-13.

V1 is frozen as a zero-data-collection build. The app stores user-entered
transactions, categories, budgets, settings, and corrupt-load recovery backups
only in local app storage on the device. It has no account, backend, internet
service, sync, advertising, analytics, purchase, subscription, Premium, or
crash-reporting surface. Authenticated nearby peer-to-peer household traffic is
the only permitted future transport boundary; it is networking and must not be
described as zero networking.

## Runtime and Release Configuration

- No crash-reporting, analytics, or telemetry SDK is installed, configured, or
  initialized.
- `npm run privacy:check` rejects internet-capable imports, browser/network
  APIs, and telemetry configuration in app code. The only exception is the
  explicitly named `platform/nearbyTransport.ts` boundary, which is reserved
  for authenticated nearby peer-to-peer traffic.

## Legacy Premium Compatibility

Older same-version persisted envelopes may contain a `premium` boolean. V1 no
longer includes that field in `AppState`, `DEFAULT_STATE`, or saved envelopes.
The loader treats it as an unknown legacy field, ignores it, and still accepts
the rest of a valid persisted envelope.

## Production-Build Network Audit

Audit target: the exact production candidate selected for App Store review.

Required journey:

1. Cold launch with a fresh install.
2. Create, edit, and delete entries.
3. Navigate months and summary.
4. Open Settings and Budgets.
5. Toggle the theme.
6. Import a local Zaim CSV and export app CSV through the system share sheet.
7. Delete all data and relaunch.

Expected result: no internet or backend requests during the required journey.
System-owned iOS file picker and share sheet UI may appear, but Kaji does not
transmit user data to an internet service from those flows. Authenticated
nearby peer-to-peer traffic, if added at the named boundary, is a separate
explicitly reviewed network path. Any future analytics SDK, ad SDK, account,
sync, or internet backend invalidates the “Data Not Collected” claim until the
audit and public privacy text are updated.

## App Store Privacy Answers

Use “Data Not Collected” only for the V1 binary described above. Do not declare
contact info, identifiers, usage data, diagnostics, purchases, financial
information, or user content collection for V1. The privacy-policy text in
`docs/privacy.html` describes the same behavior in English and Japanese.
