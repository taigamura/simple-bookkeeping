# App Build Spec — Bookkeeping (working name TBD)

**Stack:** Expo (React Native) + EAS
**Status:** Foundation / scaffold — v0.1
**Purpose of this doc:** Lock in the decisions already made and set high-level scope. This is deliberately *not* a full feature spec — it exists so future sessions can take one section (e.g. "data model", "MVP screens") and go deep without re-litigating foundations.

---

## 1. Foundations

### 1.1 Locked stack decisions

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript | Runs natively in the Claude Code loop on Windows (Dorakou). |
| Framework | Expo (React Native) | One codebase → iOS, Android, and web. |
| Cloud builds | EAS Build | Removes the Mac requirement; iOS builds run on Expo's servers. |
| Validation target | Web first | Deploy the same Expo codebase to web (shareable URL) to validate before spending on native. |
| Native distribution | App Store via EAS Submit | Requires the Apple Developer Program ($99/yr). |
| Dev machine | Windows (Dorakou) | No Mac in the loop at any point. |

**Cost reality:** Expo SDK/CLI is free. EAS free tier covers ~15 iOS + 15 Android builds/month — enough for the MVP and learning. The only unavoidable cost is the $99/yr Apple fee, and only when going native (not for the web version).

### 1.2 Why not native SwiftUI

Considered and rejected *for this workflow*. SwiftUI only compiles on an Apple toolchain, which doesn't exist on Windows and isn't reachable from inside Swift Playground on iPad. Claude Code can write Swift but couldn't close the write→build→fix loop on this setup. Expo keeps the whole loop Claude-Code-native.

### 1.3 Shipping pipeline

1. Enroll in the Apple Developer Program ($99/yr).
2. Build for web first; validate the flows.
3. `eas build` → iOS binary produced in the cloud.
4. `eas submit` → upload to App Store Connect.
5. TestFlight for real-device testing.
6. Fill in App Store Connect metadata (privacy nutrition label, age rating, screenshots) → submit for review.

_The code is the easy part; this ceremony is the actual hurdle. Getting through it once end-to-end is a goal in itself._

---

## 2. Purpose

A lightweight, actually-useful personal ledger. Keep it deliberately minimal — this app earns its keep by being *finished and shipped*, not by being feature-rich. Resist scope creep.

## 3. Scope (v1 MVP)

- Create accounts / wallets (e.g. cash, bank, card).
- Log transactions: amount, date, category, account, memo.
- Income vs expense.
- Categories (a small default set + user-added).
- Running balance per account and overall.
- A basic monthly summary (totals by category, net for the month).
- Local-first data storage on device.

## 4. Explicitly out of scope (v1)

- Multi-user / sync across devices.
- Bank/API import (e.g. SBI, kabu STATION) — tempting given your setup, but defer.
- Budgets, recurring transactions, forecasting.
- Multi-currency.
- Cloud backend of any kind.

## 5. Data model (rough sketch — _deep-dive_)

`Account { id, name, type, openingBalance }`
`Transaction { id, accountId, amount, type(income|expense), categoryId, date, memo }`
`Category { id, name, kind }`

## 6. Open questions (resolve in deep-dive)

- **Scope of "bookkeeping":** strictly personal expense tracking, or light small-business/double-entry? This changes the data model materially.
- Local storage choice (e.g. SQLite via `expo-sqlite` vs a simpler key-value store).
- Does v1 even need the App Store, or is walking the pipeline via TestFlight enough?
- Minimum screen set for MVP.

## 7. Suggested next sessions

1. **Apple Developer enrollment + Expo project scaffold** — get an empty app building for web and via EAS. (Unblocks everything.)
2. **v1 feature + data-model spec** — close §6.
