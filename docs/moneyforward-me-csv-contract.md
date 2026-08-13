# MoneyForward ME CSV contract (evidence snapshot)

Status: contract research only. Kaji does not implement a MoneyForward adapter
from this document.

Research date: 2026-08-11

## Executive conclusion

MoneyForward ME currently documents CSV **download**, not a general-purpose CSV
upload contract. Its support article says CSV upload is currently supported only
for PayPay transaction-history files, and that other data uploads are not
supported. The app's transaction-history download is a premium feature and can
export one selected year. The web export is a different, monthly download.

The current official header list is corroborated by multiple independently
published web exports from 2022 through 2024. Those observations establish a
safe subset for an adapter: fully quoted CP932 comma CSV, `YYYY/MM/DD` dates,
negative expenses, positive income, `計算対象=1`, and `振替=0` ordinary rows.
Transfers, refunds, and ID stability remain deliberately unsupported because
the public specimens do not establish their complete semantics.

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
| Delimiter and quoting | Independently published exports show comma-delimited rows with every field double quoted. | Verified for the observed web-monthly exports. Embedded quotes/newlines and newline convention remain unverified. |
| Encoding | Two independent reports that processed downloaded files identify the web export as CP932/SJIS; one demonstrates mojibake followed by successful `iconv -f SJIS`, and another reads it as `cp932`. | CP932 is the supported observed encoding. Detection must fail closed rather than silently substituting characters. BOM behavior remains unverified. |
| Date | Published exports from 2022, 2023, and 2024 consistently use zero-padded `YYYY/MM/DD`. | Verified for observed web-monthly exports. The provider does not document timezone or posting-date semantics. |
| Amount | Real published rows show expenses as negative integers and income as positive integers. | Verified for ordinary JPY expense and income rows. Zero and refund-like positive rows remain unsupported. |
| Income / expense | A published positive salary row uses `大項目=収入`, `中項目=給与`; published purchase rows are negative and use expense categories. | Direction is safely determined from the amount sign for the supported ordinary subset, with category retained as source data. |
| Transfers | Ordinary published rows use `振替=0`. The source explains that transfers represent movement between the user's own assets, but public specimens do not establish the full transfer representation or cardinality. | Import only `振替=0`; quarantine every other value. The synthetic `1` row is a rejection case, not an observed export. |
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
- ordinary expense/income rows using the observed sign convention;
- a transfer-marked row;
- a refund-shaped title, deliberately marked as semantically unresolved;
- a non-calculation row and an invalid-date row for adapter rejection tests;
- a yen-only amount column and synthetic IDs.

The ordinary fixture rows mirror the observed quoting, `1`/`0` flags, date
representation, and amount signs, while retaining synthetic values. The
`SYNTHETIC-REFUND` row must not be imported as income merely because its amount
is positive, and the synthetic `振替=1` row is a rejection test rather than a
claim about a captured transfer. The checked-in fixture is UTF-8 for repository
ergonomics; adapter byte tests must generate an equivalent CP932 byte fixture.

## Proposed import boundary

Kaji can safely make only these claims:

1. It can detect the exact ten-column web header and decode CP932.
2. It can preview ordinary `計算対象=1`, `振替=0` rows with valid
   `YYYY/MM/DD` dates and non-zero signed integer JPY amounts.
3. It must quarantine excluded, transfer, zero, malformed, and refund-ambiguous
   rows and must not treat provider `ID` as a stable deduplication key.
4. It cannot claim to import the app's annual CSV, because its headers and byte
   contract are not published in the cited text.
5. It cannot claim MoneyForward round-trip support. MoneyForward's current
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
- Froglog, [現実の CSV ファイルのデータを BigQuery に load する仕組みを作るという泥臭い作業を dlt でやってみる](https://soonraah.github.io/posts/load-csv-data-into-bq-by-dlt/), 2023-12-20. It publishes redacted expense and income rows and identifies the downloaded encoding as CP932.
- takadappara/moneyforward, [MoneyForward ME CSV download notes](https://github.com/takadappara/moneyforward), observed 2023-04. It shows raw-download mojibake, successful SJIS conversion, quoted rows, dates, negative expenses, flags, and opaque IDs.
- azuki774/mf-importer, [public 2024 web-export specimen](https://github.com/azuki774/mf-importer/blob/a6ae3dbda8da044731e83fd65d2c5938c94248c3/test/cf.csv). It corroborates the unchanged ten-column quoted schema and ordinary-row representation in 2024.
