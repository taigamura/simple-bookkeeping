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
| iOS build number | ⏳ (EAS remote + autoIncrement; was 54 → next production build **55**) |

## Release commit

| Field | Value |
|---|---|
| Commit SHA | ⏳ |
| Git tag | ⏳ (e.g. `v1.0.0`) |
| Branch | ⏳ |

## Automated quality gate — 2026-08-17 (working tree, pre-commit)

Re-run on the exact tagged commit before building; these results are from the
identical tree that became the candidate.

| Gate | Command | Result |
|---|---|---|
| Strict TypeScript | `npm run typecheck` | ✅ pass |
| Jest (warning-clean) | `npm test` | ✅ 39 suites / 466 tests, 0 `act()` / console warnings |
| Production web export | `npm run e2e:export` | ✅ clean export to `e2e/.web-build` |
| Canonical Playwright | `npm run e2e:test -- --workers=2` | ✅ 22/22 (Chromium, CI-matching 2 workers) |

Notes: Playwright is authoritative at CI's 2-worker config. Full local parallelism
(all cores) can still flake per known history; that is not the release gate.

## Production build

| Field | Value |
|---|---|
| EAS build id / URL | ⏳ |
| Profile | `production` (`eas.json`) |
| Built from tag | ⏳ |

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
| Screenshots (JP + EN) | ⏳ captured from the certified candidate — see Part 5 matrix |

## Submission

| Field | Value |
|---|---|
| Uploaded to App Store Connect | ⏳ |
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
