# おカネレコ transaction-detail CSV contract

Status: evidence-backed intake contract, not an adapter specification. This
document deliberately records unknowns instead of assigning semantics that are
not present in an export.

## Evidence

The provider's current help page says that the app can export either an
`出費/収入明細` (transaction detail) file or an `エクセル家計簿` (daily/category
summary), and can send the result as CSV or Excel. It also says that export is
selected from the list screen, for a chosen year, month, week, or day, and that
the export may include or omit receipt photos:

- [Excel/CSV export procedure](https://okane-reco.com/faq/8921/)
- [Excel/CSV export availability and premium requirement](https://okane-reco.com/faq/9782/)
- [Backup files are separate from CSV exports](https://okane-reco.com/faq/9784/)

A provider-published support blog shows the detailed export's spreadsheet
columns as the following seven uppercase headers, in this order:

```text
DATE,TIME,CATEGORY,CURRENCY,PRICE,MEMO,PAYMENT
```

The screenshot is historical, so the header order is a candidate contract
until a current export from a consented test account is captured. The
provider's current help pages describe the export workflow but do not publish a
machine-readable schema. The screenshot and workflow are documented in
[the provider's export article](https://ameblo.jp/okane-reco/entry-12302360885.html).

## Synthetic fixture

[`fixtures/okane-reco/transaction-detail.synthetic.csv`](../fixtures/okane-reco/transaction-detail.synthetic.csv)
is entirely synthetic. It contains no account names, real merchants, real
identifiers, or personal financial data. It covers:

| Fixture rows | Contract purpose | Safe conclusion |
| --- | --- | --- |
| Grocery, salary, transit | Ordinary expense/income detail rows | Date, time, category, currency, price, memo, and payment are representable fields. |
| Refund-like row | A purchase-sized positive amount with refund wording only in the memo | A refund cannot be identified from the schema alone. Do not infer refund semantics from memo text. |
| Transfer-like row | A synthetic internal-movement description | There is no documented transfer field or stable two-sided transfer identity. Do not import as a transfer. |
| Malformed date | Parser rejection | Reject the row before persistence. |
| Empty category | Parser rejection | Reject the row before persistence. |

The fixture uses positive `PRICE` values for both expense and income examples
because the public evidence shows positive-looking prices but does not state
whether the sign is encoded in `PRICE`, `CATEGORY`, or another convention.
The fixture therefore does not establish a production sign rule.

## Contract boundary for a future adapter

### Fields that can be considered for import

After a current fixture is obtained and the candidate header is confirmed, an
adapter may consider mapping:

| Provider field | Kaji field | Condition |
| --- | --- | --- |
| `DATE` | `y`, `m`, `day` | Strictly parse a provider date; reject invalid or ambiguous dates. |
| `CATEGORY` | `category` | Non-empty; expense versus income must be confirmed separately. |
| `PRICE` | `amount` | Numeric and non-zero; sign convention is still unverified. |
| `MEMO` | `note` | Preserve as text; do not parse merchant, refund, or transfer semantics from it. |
| `CURRENCY` | `currencyCode` | Only after the exported token-to-currency mapping is verified. A symbol alone is not a stable ISO code. |

`TIME` and `PAYMENT` have no direct field in the current normalized import
boundary. They must either remain provenance/unsupported fields or be omitted
without claiming that Kaji preserved them. A future adapter must not silently
discard a field that the user would reasonably expect to survive; preview it as
unsupported until that policy is decided.

### Rows and semantics that are not established

- No stable provider transaction ID appears in the seven-column evidence.
  Provenance can use Kaji's source fingerprint plus source row number, but that
  is not a provider ID and will change if the export is reordered.
- No explicit refund, transfer, balance-adjustment, or reconciliation field is
  documented. A memo, payment method, category, or matching amount is not
  enough to manufacture one.
- The evidence does not establish whether expenses are negative, whether
  income is positive, or whether `CATEGORY` carries the type. This must be
  measured from a controlled export containing one known expense and one known
  income.
- The evidence does not establish whether `CURRENCY` contains a symbol, ISO
  code, localized name, or a mixture across app versions/locales. Do not map
  `¥` to JPY without a verified current export and user-visible currency
  setting.
- The provider offers both detailed and daily/category-summary exports. The
  summary format is not a transaction format and must not be detected as one.

## Encoding and export-access assumptions

The current help page recommends CSV for Mac and warns that CSV can be
unreadable or become mojibake on Windows/Chromebook. This is operational
guidance, not a byte-level encoding guarantee. The adapter must detect/decode
the actual bytes, and a fixture from each supported encoding must be added
before claiming support for it. Until then, UTF-8 and Shift-JIS are
**unverified**, not interchangeable assumptions.

CSV export is documented as a premium feature and is delivered through the
device's mail flow. Kaji must not promise direct account access, cloud access,
or automatic retrieval. The user must explicitly provide the exported file.
The provider's backup ZIP/SQLite file is a separate, app-only restore format;
it is out of scope for a CSV adapter.

## Naming and scope

Use “おカネレコ” in user-facing source references. The provider's legal/operator
information identifies Smart Idea Inc. This project is only documenting an
import contract for user-supplied exports. It does not imply endorsement,
partnership, account integration, or support for the provider's backup format.

## Next evidence required before implementation

Obtain a fresh, consented export from the current app version containing:

1. one known expense, one known income, and one zero/negative-input edge case;
2. one non-JPY currency if the app permits it;
3. a memo containing commas, quotes, and a line break;
4. payment values, empty optional fields, and an export with and without photos;
5. the exact bytes and app/platform/version metadata, with all personal values
   replaced by synthetic values before committing.

Only after these observations should issue #97's provider adapter claim a
detected format, an encoding, a sign rule, currency mapping, or supported row
set.
