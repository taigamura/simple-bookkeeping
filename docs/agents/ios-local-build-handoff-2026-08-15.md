# iOS Local Build Handoff - 2026-08-15

This note captures the build-server-only fixes made on the macOS host `taigamura@192.168.50.175` for the Expo/EAS iOS local build of `simple-bookkeeping`. It is intended for another AI or engineer to continue from the current state without rediscovering the same failures.

## Current Result

The production local iOS build now succeeds on the Mac build server.

- Repo path: `/Users/taigamura/dev/simple-bookkeeping`
- Successful command: `EAS_SKIP_AUTO_FINGERPRINT=1 EAS_BUILD_NO_EXPO_GO_WARNING=true eas build -p ios --local --profile production --freeze-credentials`
- Final artifact: `/Users/taigamura/dev/simple-bookkeeping/build-1786769764736.ipa`
- Artifact size: about 20 MB
- Remote iOS build number after verification: `54`
- `npx expo install --fix` now reports: `Dependencies are up to date`
- `expo doctor` passed all 21 checks during the successful EAS run

## Build Server Environment Observed

- Host: `taigamura@192.168.50.175`
- macOS: `15.7.9`
- Xcode: `26.3`, build `17C529`
- Xcode SDKs observed after setup:
  - `iphoneos26.2`
  - `iphonesimulator26.2`
- Node: `v26.7.0`
- npm: `11.19.0`
- EAS CLI used for successful build: `21.8.0`, although CLI reported `22.0.0` is available
- Non-interactive SSH sessions need PATH set first:

```sh
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
```

## Problems Found And Fixes Applied

### 1. Expo SDK 57 dependency drift caused npm ERESOLVE

Initial symptom: `npx expo install --fix` tried to move the project to SDK 57 expected versions, but `npm install` failed with an `ERESOLVE` conflict around `react-native@0.86.2` and stale `@react-native/jest-preset@0.86.0` / Jest packages.

Fix applied on the Mac repo:

- Updated `package.json` and `package-lock.json` to Expo SDK 57 expected versions.
- Important resulting versions include:
  - `expo@~57.0.13`
  - `react-native@0.86.2`
  - `react-native-reanimated@4.5.1`
  - `react-native-worklets@0.10.1`
  - `@react-native/jest-preset@0.86.2`
  - `@types/jest@29.5.14`
  - `jest-expo@~57.0.4`

Verification:

```sh
npx expo install --fix
# Dependencies are up to date
```

### 2. EAS credential import failed because Apple WWDR G3 was missing

Symptom: EAS downloaded remote iOS credentials but failed validating the distribution certificate import.

Fix applied on the Mac login keychain:

```sh
cd /tmp
curl -fsSLO https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer
security import /tmp/AppleWWDRCAG3.cer \
  -k /Users/taigamura/Library/Keychains/login.keychain-db \
  -T /usr/bin/codesign \
  -T /usr/bin/security
```

After this, EAS validated the distribution certificate and provisioning profile successfully.

### 3. Xcode first-launch/platform setup was incomplete

Symptoms:

- Missing `/Library/Developer/PrivateFrameworks/CoreSimulator.framework`
- `xcodebuild` requested `xcodebuild -runFirstLaunch`
- Later EAS could not find `generic/platform=iOS` because the iOS platform support was not ready

Fixes:

- User ran `sudo xcodebuild -runFirstLaunch` locally on the Mac.
- `xcodebuild -downloadPlatform iOS` was started. It appeared to stall near the end, but after interrupting it, `xcodebuild -showsdks` showed `iphoneos26.2` and the next EAS run got past destination resolution.

### 4. Xcode 26.3 / Swift 6.3 failed compiling ExpoModulesJSI

Initial compile error:

```text
node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift:53:50:
error: type of expression is ambiguous without a type annotation
  guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds else {
                               ~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```

The installed Expo SDK 57 package already used `expo-modules-jsi@57.0.4`, which was the latest stable SDK 57 release observed. Only SDK 58 canaries were newer, so the fix was a local postinstall patch instead of upgrading outside SDK 57.

Persistent fix added:

- New file: `scripts/patch-expo-modules-jsi.mjs`
- New `package.json` script: `postinstall: node scripts/patch-expo-modules-jsi.mjs`

The patch rewrites the problematic line to use `Foundation.fabs(milliseconds)`, avoiding Swift's ambiguous global `abs` overload resolution under the current toolchain.

Important note: an earlier attempt used `Swift.abs(milliseconds)`, but this failed with `module 'Swift' has no member named 'Swift'` because `Swift` is shadowed in that compile context. The current patch script also guards against the accidental intermediate bad form `Foundation.fFoundation.fabs(milliseconds)`.

Current intended patched Swift line:

```swift
guard milliseconds.isFinite, Foundation.fabs(milliseconds) <= maxJavaScriptDateMilliseconds else {
```

Verification evidence from the successful build:

- During `npm ci` inside the EAS sandbox, postinstall printed:

```text
Patched expo-modules-jsi JavaScriptCodable+Date.swift for Swift 6.3 type inference.
```

- Xcode passed the previous `[CP-User] Build ExpoModulesJSI xcframework` failure point.
- Archive succeeded and the IPA export succeeded.

## Current Remote Working Tree

At the end of the successful build, the Mac repo had these uncommitted changes:

```text
 M package-lock.json
 M package.json
?? build-1786769764736.ipa
?? scripts/patch-expo-modules-jsi.mjs
```

Do not assume these are committed. Another agent should inspect and decide whether to commit the package updates and patch script. The generated IPA should normally not be committed.

## Commands Useful For The Next Agent

SSH into the build server:

```sh
ssh -i ~/.ssh/simple-bookkeeping-buildserver taigamura@192.168.50.175
```

Run verification on the Mac:

```sh
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
cd ~/dev/simple-bookkeeping
npx expo install --fix
EAS_SKIP_AUTO_FINGERPRINT=1 EAS_BUILD_NO_EXPO_GO_WARNING=true eas build -p ios --local --profile production --freeze-credentials
```

Check the artifact:

```sh
ls -lh /Users/taigamura/dev/simple-bookkeeping/build-1786769764736.ipa
```

## Submitting To App Store Connect

Submitting does NOT require the Mac. `eas submit` uploads a finished `.ipa` to App Store Connect via Apple's App Store Connect API (pure HTTPS, no Xcode/macOS/Transporter), so it can run from any machine, including the Linux/WSL dev box. The IPA just physically lives on the Mac after a local build; either submit from the Mac or `scp` the IPA elsewhere first.

Command (from the Mac, where the IPA is):

```sh
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH
cd ~/dev/simple-bookkeeping
eas submit -p ios --profile production --path ~/dev/simple-bookkeeping/build-<timestamp>.ipa
```

Notes and gotchas:

- `eas submit --latest` does NOT work for a `--local` build (nothing was uploaded to EAS cloud). Always pass `--path`.
- The `submit.production` profile in `eas.json` is currently empty `{}`, so submit is interactive: it prompts for Apple ID login (2FA) and resolves the app. `ascAppId` alone only skips the app-existence check; the actual upload still needs Apple ID auth or an ASC API key.
- Interactive submit must run in a REAL terminal (a normal SSH session), NOT through Claude Code's `!` prefix, which has no TTY (`Input is required, but stdin is not readable. Failed to display prompt: Apple ID:`).
- Keychain-locked-over-SSH failure (2026-08-15): Apple login over SSH failed with `Authentication with Apple Developer Portal failed! Security returned a non-successful error code: 36`. This is a macOS keychain error, not a wrong password: spaceship tried to cache the session in the login keychain, which is locked on a headless SSH session. Fix by unlocking first (`security unlock-keychain ~/Library/Keychains/login.keychain-db`, enter the Mac login password) then submitting, or by prepending `FASTLANE_DONT_STORE_PASSWORD=1` to skip the keychain write. The 2026-08-15 submit succeeded after `security unlock-keychain`.
- Hands-off alternative: create an App Store Connect API key (`.p8`, App Manager role) and set `ascApiKeyPath` / `ascApiKeyId` / `ascApiKeyIssuerId` (+ `ascAppId`) in `submit.production`. This removes Apple ID login and the keychain entirely, enabling `eas submit --non-interactive`.

## Remaining Notes

- npm still reports `25 vulnerabilities` (`9 moderate`, `16 high`). These did not block the local iOS build.
- EAS warns that `ios.buildNumber` in app config is ignored because version source is remote. This did not block the build.
- Sentry config warnings appear because organization/project are not configured in the Expo plugin. `SENTRY_DISABLE_AUTO_UPLOAD=true` was loaded from the EAS profile, and the warning did not block the build.
- Fastlane warned that the Sentry debug-symbol upload script has ambiguous dependencies and may run every build. This is not currently fatal.
