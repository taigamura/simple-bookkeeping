# Autonomous integration handoff

Issue #121 closes the autonomous delivery phase for the bounded household,
import, iPhone quick-entry, and Watch companion work. It is an integration
candidate only. A green local gate proves the TypeScript and exported-web
behaviour below; it does not certify an iOS binary, an Apple Watch, App Store
metadata, or a public product name.

## Auditable local gate

Run these commands from this commit before beginning the human release work:

```bash
npm run typecheck
npm test -- --runInBand
npm run privacy:check
export E2E_WEB_BUILD_DIR="$(mktemp -d /tmp/kaji-e2e-XXXXXX)"
npx expo export --platform web --output-dir "$E2E_WEB_BUILD_DIR"
npm run e2e:test
```

The Jest suite includes the generated iOS configuration checks for the
quick-entry widget/control and Watch targets. Those checks run Expo prebuild
in a temporary directory and inspect generated targets, entitlements, App
Group wiring, and the WatchConnectivity acknowledgement contract. They are
source/configuration evidence only, not an Xcode build or hardware result.

The exported build is deliberately separated from the tracked `e2e/.web-build`
fixture when an existing checkout contains generated artifacts: export to a
temporary directory, set `E2E_WEB_BUILD_DIR` for Playwright, and remove only
that temporary directory after the run. This preserves user-owned artifacts.

## Decision ledger

| Area | Autonomous decision now in the candidate | Deliberate boundary |
| --- | --- | --- |
| Data and privacy | Personal financial data remains local-first. There is no account, backend, cloud/remote sync, analytics, advertising, purchase, or telemetry surface. | Paired, authenticated nearby household transfer is local networking while both phones are open. It is never described as zero networking or no transmission. |
| Household replication | At most two paired household phones exchange encrypted changes nearby, with local conflict/recovery behavior. | No remote/background sync, server, account, or broader multi-device topology. |
| CSV import | One Settings journey detects verified Zaim, MoneyForward ME, and おカネレコ CSV contracts, previews tallies, and applies once atomically. | Unsupported, ambiguous, oversized, cancelled, and invalid input makes no ledger write. Recurrence rules are not reconstructed from CSV. |
| iPhone quick entry | Generated iOS widget, Siri/Shortcuts intent, and iOS 18 control share a hydrated, today-only expense path through the App Group inbox. Inline entry has an amount, selected recent category, and explicit Save. | No inline income, notes, recurrence, alternate date, or one-tap transaction. iOS 16.4 remains launch-only; iOS 17 supplies the interactive widget; iOS 18 adds the control. |
| Apple Watch | Generated development scaffold accepts today-only expenses with recent categories, explicit Save, a retrying WatchConnectivity command queue, exact acknowledgement, and shared allowance complication data. | The Watch is not production-ready or certified. The React Native phone app remains the sole ledger writer. |
| Accessibility and craft | Changed web surfaces have focused small/large phone, light/dark, JP/EN, reduced/full-motion checks. Save feedback is a circular app-canvas wave and reduced motion preserves the resulting state without the wave. | Native VoiceOver and Dynamic Type are hardware checks, not simulated certification. |
| Release identity | `Kaji` and `com.taigamura.kaji` remain working/registered identifiers. Extension and App Group identifiers derive from that namespace. | Selecting or applying the final public name is blocked for human review. Do not change the registered bundle identifier. |

## Required human gates

None of the following has been executed or claimed by this integration task.

1. Produce a production EAS build from this exact green commit. Do not use a
   build produced from later source or configuration changes.
2. Install that exact binary on a real iPhone via TestFlight. Run the release
   smoke test in [Public V1 Readiness](appstore-readiness.md), including cold
   launch, CRUD, imports/exports, persistence, locales, themes, budgets,
   nearby-pairing disclosure, and quick-entry reconciliation.
3. On physical iPhone hardware, verify widget availability by supported OS,
   interactive Save/duplicate handling, Siri/Shortcuts cancellation and
   killed-app delivery, iOS 18 Control Center/Lock Screen/Action Button routing,
   VoiceOver order, and Dynamic Type.
4. On a real paired Apple Watch, verify target installation, pairing, offline
   retry, acknowledgement after iPhone relaunch, complication update,
   accessibility, and the generated targets as described in
   [Apple Watch expense companion](apple-watch-companion.md).
5. Run the exact-binary traffic procedure in
   [Production binary network audit](production-binary-network-audit.md).
   Record expected authenticated local peer traffic and confirm no public
   backend traffic.
6. Verify the App Store privacy questionnaire against that binary and current
   App Store Connect definitions. “Data Not Collected” remains an assumption
   until this human check, not a completed declaration.
7. Select the final public product name in human review, then apply the
   checklist in [App Store Publication Package](appstore-publication-package.md).
   Re-check Japanese and English metadata, screenshots, privacy/support URLs,
   Finance category, age rating, export compliance, and review notes. Do not
   change `com.taigamura.kaji`.

## Handoff rule

If any source, configuration, App Store metadata, or native behavior changes
after these gates pass, produce a new green commit and repeat the affected EAS,
device, privacy, and metadata checks. Local verification is not a substitute
for those human gates.

## Related

- [Public V1 Readiness](appstore-readiness.md)
- [V1 Privacy Mode](v1-privacy-mode.md)
- [Apple Watch expense companion](apple-watch-companion.md)
- [App Store Publication Package](appstore-publication-package.md)
