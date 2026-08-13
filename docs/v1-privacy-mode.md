# V1 Privacy Mode

Status date: 2026-07-13.

V1 is frozen as a zero-data-collection build. The app stores user-entered
transactions, categories, budgets, settings, and corrupt-load recovery backups
only in local app storage on the device. It has no account, sync, advertising,
analytics, purchase, subscription, Premium, or enabled crash-reporting surface.

## Runtime and Release Configuration

- `app.json` keeps `expo.extra.sentryDsn` blank.
- Every EAS profile in `eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD=true`.
- `platform/errorReporting.ts` returns before calling `Sentry.init` when the
  DSN is blank, and `platform/errorReporting.test.ts` locks that behavior.
- No analytics or telemetry SDK is installed or initialized.

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

Expected result: no app-initiated network requests during the required journey.
System-owned iOS file picker and share sheet UI may appear, but Kaji does not
transmit user data from those flows. Any future non-empty Sentry
DSN, analytics SDK, ad SDK, account, sync, or purchase integration invalidates
the “Data Not Collected” claim until the audit and public privacy text are
updated.

## App Store Privacy Answers

Use “Data Not Collected” only for the V1 binary described above. Do not declare
contact info, identifiers, usage data, diagnostics, purchases, financial
information, or user content collection for V1. The privacy-policy text in
`docs/privacy.html` describes the same behavior in English and Japanese.
