---
name: eas-build-loop
description: Run an EAS build to green — submit, poll, read the real compile errors, fix, rebuild. Use when asked to build/ship the iOS or Android app, or to get a failing EAS build passing.
---

# Driving an EAS build to green

`node scripts/eas-build-loop.mjs run` does one iteration: submit → poll →
extract errors. It never fixes anything — **you** are the fix step. Loop:

```bash
node scripts/eas-build-loop.mjs run            # exit 0 = green, 1 = fix these, 2 = stop
# exit 1 -> read the error lines, fix the code, run again
```

Flags: `--platform ios|android` (default ios), `--profile` (default production),
`--timeout-minutes` (default 40). `run <buildId>` watches an existing build
instead of submitting; `errors <buildId>` just re-prints a past build's errors.

## Exit codes are the loop control

- **0** — FINISHED. The `.ipa` URL is on stdout. Stop.
- **1** — ERRORED with extracted compile errors. Fix and re-run. This is the
  only code you should ever retry on.
- **2** — STOP. Infra/credentials/quota, no extractable errors, poll timeout, or
  **an error signature identical to the previous iteration** (meaning your last
  fix did not take — re-read the code, do not just rebuild). Retrying a 2 burns
  quota and build numbers for nothing.

## Before you start

- **Check `git status`.** EAS ships your **uncommitted working tree**, not HEAD.
  This is why the loop needs no commits — but it also means a dirty tree
  silently changes what you build, and a green build may not be reproducible
  from git. Offer to commit once green.
- `production` has `autoIncrement` with `appVersionSource: remote`, so **every
  iteration burns a remote build number**, including failures. Don't leave the
  loop running unattended without a cap.
- Failures usually die in 1–3 min (Xcode compile). A *successful* production
  build takes ~3–25 min. A long poll is not a hang.

## Gotchas this script already handles

Don't re-derive these — they cost real time:

- **`--non-interactive` is not uniformly supported.** `build:view` and
  `credentials:configure-build` *reject* the flag; `build:list` accepts it. A
  poll built on `build:view --non-interactive` reads an empty status and spins
  until timeout instead of failing loudly. The script filters `build:list` by id.
- **Logs are brotli served as `text/plain`.** Plain `curl`/fetch returns binary
  garbage. `curl --compressed` is required.
- **Worker log lines are bunyan JSON**; the human text is in `.msg`.
- The EAS summary message lists only *some* detected errors. Always read the
  extracted `error:` lines — they carry file:line.

## Fixing well (this is the part that saves iterations)

Native compile errors surface **one layer at a time**: each build reveals the
next file that failed to compile. To avoid burning one build per instance:

- **Grep for siblings of the pattern you just fixed before rebuilding.** Real
  example: `struct X: Exception` failed in `kaji-nearby`; the identical bug sat
  in `kaji-quick-entry` and would have failed the very next build alone.
- Fix the *cause*, not the line. `error: inheritance from non-protocol type
  'Exception'` means `ExpoModulesCore.Exception` is an `open class`, not a
  protocol — subclass `GenericException<String>` (it supplies the positional
  `init(_:)` call sites already use and lets you `override var reason`).
- Don't let a fix change behavior to appease the compiler. `compactMap` returns
  a non-optional array so it can't be `guard let`-bound; split the guard and
  keep the count checks that were doing the real validation.

## Submitting to App Store Connect

Out of scope — this skill stops at a signed artifact. `eas submit` is a separate,
outward-facing action: ask first.
