# Suito — V1 Release Record

The single auditable record for the V1 App Store submission (issue #79). One tagged
commit + one production EAS build = the release candidate. Fill the `⏳` fields as the
final gates complete; submit only the exact build recorded here.

## Identity

| Field | Value |
|---|---|
| Public name | **Suito** (final, confirmed 2026-08-17) |
| iOS bundle id | `com.taigamura.kaji` (preserved — internal only, never user-facing) |
| Android package | `com.taigamura.kaji` (Android not a V1 store gate) |
| Expo slug | `kaji` |
| EAS project id | `130c36b5-0731-4688-9e25-e7dd5dd87615` |
| Marketing version | `1.0.0` |
| iOS build number | **61** (EAS remote autoIncrement, 60 → 61) |

## Release commit

| Field | Value |
|---|---|
| Commit SHA | `b96f06d` (merge of PR #136 into main) |
| Git tag | `v1.0.0-build61` (annotated, pushed) |
| Branch | `main` |

## Automated quality gate — 2026-08-17 (candidate commit `b96f06d`)

Re-run on the exact candidate commit before building; these results are from the
identical tree that became the candidate.

| Gate | Command | Result |
|---|---|---|
| Strict TypeScript | `npm run typecheck` | ✅ pass |
| Jest (warning-clean) | `npm test` | ✅ 41 suites / 478 tests, 0 `act()` / console warnings |
| Production web export | `npm run e2e:export` | ✅ clean export to `e2e/.web-build` |
| Canonical Playwright | `npm run e2e:test -- --workers=2` | ✅ 22/22 (Chromium, CI-matching 2 workers) |

Notes: Playwright is authoritative at CI's 2-worker config. Full local parallelism
(all cores) can still flake per known history; that is not the release gate.

## Production build

| Field | Value |
|---|---|
| EAS build id / URL | local build (Mac build server); artifact `build-1786952228653.ipa` (20.3 MB) |
| Profile | `production` (`eas.json`) |
| Built from tag | `v1.0.0-build61` (`b96f06d`) |

## Native smoke test (TestFlight — exact candidate)

| Field | Value |
|---|---|
| Device / iOS version | ⏳ |
| Result | ⏳ |

Checklist (all must pass on the recorded build): cold launch · both launch
destinations · create/edit/delete · month navigation · budgets · sheet
open/scroll/dismiss/reopen · JP/EN locale · light/dark theme · lock/unlock ·
haptics · Shift-JIS Zaim import · CSV export/share · delete-all confirmation ·
relaunch persistence · **runtime network capture shows zero transmission** (final
proof of the "Data Not Collected" privacy answer).

## Privacy configuration (as submitted)

| Field | Value |
|---|---|
| App Store privacy answer | **Data Not Collected** |
| Sentry DSN | blank (`app.json` `extra.sentryDsn = ""`) → `errorReporting.init()` no-ops |
| Sentry auto-upload | disabled (`SENTRY_DISABLE_AUTO_UPLOAD=true`, all EAS profiles) |
| Network calls in app code | none (verified 2026-08-17) |
| Export compliance | `usesNonExemptEncryption: false`; no CCATS review |

Holds only while the DSN stays blank; filling it reopens this answer and privacy.html.

## Store listing package

| Field | Value |
|---|---|
| Copy (EN + JP) | Approved as-is 2026-08-17 — see `docs/appstore-publication-package.md` |
| Category / Rating | Finance / 4+ |
| Copyright | 2026 Taiga Kimura |
| Privacy Policy URL | https://taigamura.github.io/simple-bookkeeping/privacy.html (live, HTTP 200) |
| Support URL | https://github.com/taigamura/simple-bookkeeping |
| Support email | taigamura.dev@gmail.com |
| Screenshots (JP + EN) | ✅ 8 shots @ 1320×2868 (6.9"): EN + JP × Calendar/Summary/Entry/Settings, captured from build 61 via iOS 26.3 simulator + sample data, clean 9:41 status bar |

## Submission

| Field | Value |
|---|---|
| Uploaded to App Store Connect | ✅ 2026-08-17 (build 61; EAS submission `e7ead3a4-0231-4ff8-be6e-25478ed168cb`; processing on Apple side) |
| App Review contact email set | ⏳ (taigamura.dev@gmail.com) |
| Submitted for review | ⏳ |

---

## Decision log (human decisions, 2026-08-17)

1. Final name = **Suito**.
2. Preserve all internal identifiers (bundle/slug/storage keys).
3. Support URL = repo; support email = taigamura.dev@gmail.com.
4. Version model: 1.0.0 marketing + EAS-remote build numbers (removed stale `ios.buildNumber`; `package.json` → 1.0.0).
5. Listing copy approved as-is; copyright fixed to 2026.
6. Privacy = "Data Not Collected" (verified).
