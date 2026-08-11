# Import pipeline

Imports cross one provider-neutral boundary in `domain/importPipeline.ts`.
Adapters detect and parse external data into `NormalizedImportRow` values only.
They do not create persisted `Transaction` objects or mutate categories.

`previewImport` validates rows, records explicit skip tallies, checks the
configured currency, and attaches `{ provider, sourceId, row }` provenance.
The source fingerprint makes an exact re-import idempotent while distinct rows
with identical financial values remain distinct purchases. `applyImportPreview`
is the atomic state boundary: an unknown or ambiguous format produces a
no-write preview and returns the original state unchanged.

The Zaim adapter remains available as `zaimImportAdapter`; `parseZaimCsv` is
retained as the compatibility facade for the existing Settings flow.

`okaneRecoImportAdapter` accepts only the documented seven-column, UTF-8
transaction-detail export. It maps ordinary positive-yen rows, treats only the
literal `収入` category as income, and rejects wrong currencies, malformed
records, and unrecognized headers. Because the export has no verified transfer
or refund marker, it does not infer either semantic from `MEMO` or `PAYMENT`.

`moneyforwardMeImportAdapter` accepts only the verified ten-column MoneyForward
ME web-monthly export. It validates CP932 bytes (and the UTF-8 synthetic
fixture), accepts `計算対象=1` and `振替=0` ordinary JPY rows, and maps only
positive rows whose `大項目` is `収入` as income. Other positive rows are not
guessed to be refunds or income and are explicitly skipped.
