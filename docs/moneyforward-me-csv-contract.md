# MoneyForward ME CSV contract (evidence snapshot)

Status: contract research only. Kaji does not implement a MoneyForward adapter
from this document.

Research date: 2026-08-10

## Executive conclusion

MoneyForward ME currently documents CSV **download**, not a general-purpose CSV
upload contract. Its support article says CSV upload is currently supported only
for PayPay transaction-history files, and that other data uploads are not
supported. The app's transaction-history download is a premium feature and can
export one selected year. The web export is a different, monthly download.

Therefore Kaji may safely accept a future adapter only after it has a captured,
versioned provider fixture and an explicit mapping review. It must not infer an
adapter from the provider name, from the PayPay import format, or from the
synthetic fixture in this repository.

## Evidence-backed surface

| Surface | Verified fact | Consequence for Kaji |
| --- | --- | --- |
| App transaction history | Premium users can download one year of transaction history as CSV. Web cannot perform this one-year operation. | App and web files must be treated as separate variants. |
| Web household-budget export | The documented fields are `計算対象`, `日付`, `内容`, `金額（円）`, `保有金融機関`, `大項目`, `中項目`, `メモ`, `振替`, `ID`. The export is monthly. | These are the only currently documented headers suitable for a candidate web fixture. |
| Web institution export | The same documented fields are available per institution, also one month at a time. | Institution name is a source field, not an account identity Kaji can safely persist yet. |
| CSV upload into MoneyForward ME | Current support says only PayPay CSV files can be read; other uploads are unsupported. | Do not describe Kaji's future import as a MoneyForward-supported upload or round trip. |
| Provider identity | The product is named `マネーフォワード ME` in the provider's support material. | Use “MoneyForward ME” / `moneyforward-me` as the provider label; do not use “Money Forward Cloud” for this contract. |

## Field contract and confidence

The table below distinguishes what the sources establish from what still needs a
real, user-supplied export fixture. “Unknown” is intentional: it prevents an
adapter from silently fabricating financial meaning.

| Field / concern | Current finding | Confidence |
| --- | --- | --- |
| Header names | The ten web-export names in the table above are explicitly listed by the official support page. | Verified for the documented web export; app header names are not established. |
| Delimiter and quoting | CSV is stated, but delimiter, quote/escape rules, newline convention, and whether a UTF-8 BOM is emitted are not stated in the text source. | Unknown. The fixture uses ordinary comma CSV and UTF-8 only as a test artifact. |
| Encoding | No encoding is specified by the cited support pages. Japanese text makes an encoding probe mandatory. | Unknown. Do not assume UTF-8, Shift_JIS, or CP932 in an adapter. |
| Date | A `日付` field is documented. Exact format, zero-padding, timezone, and whether posting/use date is used are not specified by the CSV contract. | Field verified; representation unknown. |
| Amount | `金額（円）` is documented as a yen amount. The published text does not establish whether expense rows are negative, income rows positive, or both use an unsigned amount plus another indicator. | Currency field meaning verified as yen; sign convention unknown. |
| Income / expense | The support UI documentation describes both支出 and収入 records, but does not specify how their direction is encoded in the CSV. | Unknown for CSV. Never infer from a title or category. |
| Transfers | `振替` is a documented column. The source explains that transfers represent movement between the user's own assets, but does not specify every CSV value or whether both sides are exported. | Transfer concept verified; values/cardinality unknown. A future adapter must skip or model explicitly until captured. |
| Refunds | No refund marker or refund-specific field is documented. A positive amount with a refund-like title cannot be safely distinguished from income. | Unsupported until a source fixture and policy exist. |
| Currency | The documented amount column is explicitly yen (`円`) and no currency-code column is listed. | Treat as JPY-only if the exact web variant is verified; reject or quarantine any non-JPY variant. Do not add FX semantics. |
| Stable IDs | `ID` is a documented field. The source does not promise stability across edits, re-downloads, account relinking, or export variants. | Presence verified; deduplication stability unknown. Do not use it as a stable identity without a captured repeat-export test. |
| Known variants | App annual export, web monthly household-budget export, and web monthly institution export are separately documented. PayPay import CSV is a separate provider-input format, not a MoneyForward export contract. | Variant split verified; app and PayPay headers unknown here. |

## Synthetic fixture policy

[`fixtures/moneyforward-me/web-monthly.synthetic.csv`](../fixtures/moneyforward-me/web-monthly.synthetic.csv)
is safe-to-commit test data. It contains no real account, merchant, person, or
provider record. Values use an unmistakable `SYNTHETIC` prefix where a human
could mistake an identifier for a real one.

The fixture covers:

- the ten documented web headers;
- ordinary expense/income-shaped rows, without declaring the sign convention;
- a transfer-marked row;
- a refund-shaped title, deliberately marked as semantically unresolved;
- a non-calculation row and a blank/invalid row for adapter rejection tests;
- a yen-only amount column and synthetic IDs.

The fixture's signs and values are **test cases, not observations**. In
particular, the `SYNTHETIC-REFUND` row must not be imported as income merely
because its amount is positive, and the transfer row must not become a normal
expense. The fixture does not establish encoding, date parsing, transfer values,
refund semantics, or stable-ID guarantees.

## Proposed import boundary

Until a real export is available, Kaji can make only these claims:

1. It can document the candidate web header set above.
2. It can build a preview-only adapter against a captured fixture once the
   encoding, date representation, amount direction, transfer values, and ID
   repeatability have been verified.
3. It cannot claim to import the app's annual CSV, because its headers and byte
   contract are not published in the cited text.
4. It cannot claim MoneyForward round-trip support. MoneyForward's current
   upload support is PayPay-specific.

The first real-data-free follow-up should be a paired export test: export the
same synthetic or redacted account twice without edits, then edit one record and
export again. Record the bytes, headers, encoding, date and amount behavior, and
whether `ID` remains stable. Do not commit personal financial data; retain only
the redacted fixture and a checksum/observation note.

## Sources

- MoneyForward ME support, [家計簿データはダウンロードできますか](https://support.me.moneyforward.com/hc/ja/articles/49505374073497-%E5%AE%B6%E8%A8%88%E7%B0%BF%E3%83%87%E3%83%BC%E3%82%BF%E3%81%AF%E3%83%80%E3%82%A6%E3%83%B3%E3%83%AD%E3%83%BC%E3%83%89%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%99%E3%81%8B), updated 2026-04-03. It documents the app annual CSV and the web monthly field list.
- MoneyForward ME support, [CSV、Excelによるデータのアップロードはできますか](https://support.me.moneyforward.com/hc/ja/articles/900003501806-CSV-Excel%E3%81%AB%E3%82%88%E3%82%8B%E3%83%87%E3%83%BC%E3%82%BF%E3%81%AE%E3%82%A2%E3%83%83%E3%83%97%E3%83%AD%E3%83%BC%E3%83%89%E3%81%AF%E3%81%A7%E3%81%8D%E3%81%BE%E3%81%99%E3%81%8B), updated 2026-01-29. It says CSV reading currently supports PayPay data only and other uploads are unsupported.
- MoneyForward ME support, [「入出金」画面の表示を知ろう！](https://support.me.moneyforward.com/hc/ja/articles/24478005732889--%E5%85%A5%E5%87%BA%E9%87%91-%E7%94%BB%E9%9D%A2%E3%81%AE%E8%A1%A8%E7%A4%BA%E3%82%92%E7%9F%A5%E3%82%8D%E3%81%86), updated 2026-04-28. It describes the provider's expense/income/transfer concepts and the premium download surface, but does not define CSV signs or encodings.
