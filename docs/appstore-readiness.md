# App Store Readiness Plan

Assessment date: 2026-07-04. Kaji is solid as software but ~60% of the way to
a shippable App Store product. The gap is shipping infrastructure, the
data-safety story, and two placeholder features (Premium toggle, house-ad
card) that App Review will care about. This doc is the working checklist —
tackle items top to bottom; each should be a small, reviewable branch.

## Current strengths (context, not tasks)

- Clean domain/store/UI separation with tests alongside code.
- Versioned persistence envelope (`store/schema.ts` `SCHEMA_VERSION`) behind a
  swappable `Persistence` seam (`store/persistence.ts`).
- Differentiating feature: Zaim CSV import with Shift-JIS handling.
- Bundled fonts, platform icons, designed empty states.
- "Small, finished app" is a viable positioning — protect it.

## Phase 1 — Hard blockers (required before any submission)

### 1. Build/submit configuration
- [ ] `eas init` + `eas build:configure` → commit `eas.json`.
- [ ] Add `ios.bundleIdentifier` and `android.package` to `app.json`.
- [ ] Add `ios.buildNumber` / `android.versionCode`.
- [ ] Wire up the splash screen (`expo-splash-screen` plugin) — the
      `assets/splash-icon.png` asset exists but is not configured, so builds
      currently get the default splash.

### 2. Native validation (do immediately after #1 — may reshuffle priorities)
- [ ] EAS build → TestFlight on a real iPhone.
- [ ] Verify the risky-on-native areas: RN `Modal` bottom sheets, safe-area
      insets, document picker + Shift-JIS decode for Zaim import,
      keyboard/keypad interaction.
- [ ] Fix what breaks before continuing with feature work.

### 3. Resolve the Premium placeholder (review-rejection risk)
The local `premium` boolean with a "Premium / Remove ads" toggle in Settings
(build decision 7) will fail App Review as-is: a free switch implying a
purchase is misleading, and unlockable features must go through IAP. The
house-ad card labeled "Sponsored" in `ui/AdCard.tsx` is also a fake ad —
review-risky on its own.

Decision (leaning): **strip both for v1** — hide the toggle, remove the ad
surfaces — and reintroduce them together in 1.1 with real IAP + real ads.
- [ ] Option A (v1 lean): hide Premium toggle; remove/gate off `AdCard`
      surfaces on Calendar, Summary, and Entry sheet.
- [ ] Option B (if monetizing now): RevenueCat IAP, including the
      Apple-required "Restore purchases" button; real ad network for the ad
      slots.

### 4. Privacy policy + store listing
Required even for a fully local app. Ours is the easy case ("no data
collected, nothing leaves the device") but it must exist as a hosted URL.
- [ ] Write and host a privacy policy.
- [ ] Fill App Store privacy nutrition labels ("Data Not Collected").
- [ ] Screenshots, description, keywords, category, age rating.

## Phase 2 — Competence gaps (what makes it competent, not just accepted)

### 5. Data export/import (highest-value single addition)
Everything lives in one AsyncStorage blob — delete the app, lose your entire
financial history. For a money tracker that's a trust-killer and will show up
in reviews. Preserves the local-first/no-accounts identity while removing its
scariest downside.
- [ ] "Export data" row in Settings: share a JSON (or CSV matching the Zaim
      format we already parse) via the share sheet (`expo-file-system` is
      already a dependency).
- [ ] Import counterpart → backup/restore + device-migration story with no
      sync infrastructure.

### 6. Corrupt-load safety net
`load()` falls back to defaults when the version doesn't match or parse
fails — a corrupt read silently presents an empty ledger and the next save
overwrites the blob. Worst failure mode in the app.
- [ ] Before falling back, copy the unparseable blob to a second key
      (e.g. `kaji:state:corrupt`).
- [ ] Surface a notice to the user so the data is recoverable.

### 7. Japanese localization
The app is named 家事/家計, imports from Zaim, defaults to ¥ — the real
market is almost certainly Japan.
- [ ] JP + EN string localization.
- [ ] Japanese App Store listing.

### 8. Polish that reads as "competent"
- [ ] Haptic feedback on keypad + save (`expo-haptics`).
- [ ] Optional Face ID / passcode lock — it's financial data
      (`expo-local-authentication`).
- [ ] Crash reporting (Sentry's Expo integration) so production isn't debugged
      blind.

## Suggested order

1. Phase 1 #1–2: EAS setup + TestFlight on a real device; fix what breaks.
2. Phase 2 #5–6: export/import + corrupt-load safety net.
3. Phase 1 #3: Premium decision (lean: strip for v1, monetize in 1.1).
4. Phase 1 #4 + Phase 2 #7: privacy policy, store listing, JP localization.
5. Submit. Phase 2 #8 items can land any time they fit.

Items 1–2 of this ordering are non-negotiable; the rest is sequencing
preference.
