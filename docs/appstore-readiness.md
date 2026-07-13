# Public V1 Readiness

Assessment date: 2026-07-13. Core product development is complete and native
iOS testing is accepted as good enough to proceed toward release. This
document records the current baseline and the remaining work required to make
V1 an official, public App Store release.

The implementation PRD is GitHub issue
[#72 — Official public V1 release readiness](https://github.com/taigamura/simple-bookkeeping/issues/72).

The current name, **Kaji**, is a working name. Choosing the final public name
is intentionally deferred, but applying it consistently is a release gate.

## Product contract for V1

V1 is a small, local-first personal income and expense tracker. It includes:

- Calendar-based income and expense entry, editing, and deletion.
- Monthly totals, category breakdowns, and total or per-category budgets.
- Editable categories, four display currencies, dark/light themes, and an
  optional Face ID/device-passcode lock.
- Japanese and English UI selected from the device locale.
- Zaim-compatible CSV import and export, including Shift-JIS import.
- Corrupt-load recovery through a separately stashed, exportable backup.

V1 deliberately has no accounts/wallets, cloud backend, sync, advertising,
in-app purchases, analytics, enabled crash reporting, bank integrations, or
currency conversion.

## Completed baseline

- [x] Expo/EAS project, iOS bundle identifier, iOS build number, production
      version, encryption declaration, splash screen, and app icons configured.
- [x] EAS development, preview, production, and submission profiles committed.
- [x] Core product functionality implemented with JP/EN localization.
- [x] Premium and fake-ad surfaces removed from the user experience.
- [x] CSV import/export and corrupt-load safety net implemented.
- [x] Haptics and optional native device authentication implemented.
- [x] Privacy policy written and hosted in English and Japanese.
- [x] Sentry kept inert with a blank DSN and source-map upload disabled.
- [x] Real-iPhone behavior tested and accepted as sufficient to enter the
      release-candidate phase.
- [x] Total/per-category budgets, delete-all-data, launch destination, and
      recent sheet/calendar polish implemented.

## Release gates

### 1. Trustworthy automated quality gate

- [ ] Resolve the open P0 bottom-sheet regression tracked in GitHub issue #63.
- [ ] Make every canonical Playwright scenario pass in CI without expected
      failures, retries, skips, debug-only probes, or weakened assertions.
- [ ] Decide whether diagnostic probe specs become stable assertions or move
      outside the default release suite.
- [ ] Remove React `act(...)` warning noise from the Jest run so new warnings
      are visible.
- [ ] Keep strict TypeScript, all Jest suites, the web export, and Playwright
      green on the release commit.

### 2. Financial-data boundary hardening

- [ ] Runtime-validate persisted state rather than trusting any parseable JSON
      with the current version number.
- [ ] Serialize whole-state writes so a slower earlier save cannot overwrite a
      newer state.
- [ ] Give import, export/share, and persistence failures user-visible recovery
      paths; no financial-data operation should fail only in the console.
- [ ] Verify a full exported CSV can restore an empty installation without
      losing supported transaction fields or duplicating entries.
- [ ] Preserve and test the corrupt-stash behavior for invalid data.

### 3. Release identity and repository cleanup

- [ ] Choose the final public name, then update the Expo name/slug where safe,
      on-device copy, icons containing text, privacy policy, support copy, and
      App Store metadata consistently. Do not change the existing bundle
      identifier casually.
- [ ] Reconcile package and Expo version metadata for the official V1 release.
- [ ] Remove the unused Premium state and dead ad component, or document a
      concrete compatibility reason for retaining them.
- [ ] Update durable build decisions that still describe removed Premium/ad
      behavior or superseded sheet implementation details.
- [ ] Ensure README, privacy policy, release checklist, and App Store claims all
      describe the same shipped behavior.

### 4. App Store publication package

- [ ] Create final Japanese and English name, subtitle, description, keywords,
      promotional copy, and support contact details.
- [ ] Complete Finance category, age rating, copyright, privacy-policy URL,
      support URL, and export-compliance metadata.
- [ ] Declare “Data Not Collected” only while Sentry, analytics, advertising,
      and every other transmission path remain disabled.
- [ ] Capture current Japanese and English screenshots for every App Store
      device class required by App Store Connect.
- [ ] Write review notes explaining that the app is local-only, has no account
      or login, and imports Zaim CSV through Settings.
- [ ] Verify the public privacy-policy URL and support contact from a logged-out
      browser.

### 5. Release candidate and submission

- [ ] Produce a clean production EAS build from a tagged, green commit.
- [ ] Install that exact build through TestFlight and run the short release
      smoke test: cold launch, both launch destinations, create/edit/delete,
      month navigation, budgets, Settings/Budgets sheets, JP/EN locale, theme,
      lock/unlock, Zaim import, CSV export, delete-all confirmation, relaunch,
      and persistence.
- [ ] Confirm there are no placeholder labels, fake purchase/ad surfaces,
      debug controls, unexpected network requests, or developer-only sample
      data in the initial experience.
- [ ] Submit the tested build and archive the final checklist, build number,
      commit, and App Store metadata snapshot.

## Release definition of done

V1 is ready to publicize when all release gates above are complete, the final
name is consistently applied, the exact submitted build passes the native
smoke test, and the public listing makes only claims the binary and privacy
policy can support.

Android publication is not a V1 gate. Android configuration may remain in the
Expo project, but Android store validation and listing work belong to a later
release.
