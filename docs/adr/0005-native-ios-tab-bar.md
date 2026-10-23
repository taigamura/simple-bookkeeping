# ADR-0005 — iOS uses the system tab bar

- **Status:** accepted (2026-10-03), awaiting on-device verification
- **Supersedes:** the custom glass `TabBar` on iOS (PR #140)
- **Shipped in:** PR #142 (`aec9469`), TestFlight 1.0.1

## Context

PR #140 rebuilt the bottom bar as a floating Liquid Glass capsule with a sliding
selection lens. It went through six iterations: a painted lens, a rainbow-filled
lens, an SVG rainbow ring, and finally `expo-glass-effect`'s `GlassView` (the
real iOS 26 material) placed inside our own layout. None of them read as native:

- The real effect (refraction, the morphing lens) belongs to `UITabBar` itself.
  A `GlassView` nested in our own capsule renders flat glass, not Apple's bar.
- The lens slid on a JS spring between measured frames. It also shipped
  misplaced: 7.5px high, and off on Summary because it reused Calendar's width.
- Web (`npm run web`) can only ever show a hand-made fallback. That is what
  Taiga was looking at when they judged it "a replica".

## Decision

On iOS the tab bar is the OS's own `UITabBar`, via `react-native-bottom-tabs`
(`nav/NativeTabHost.tsx`). On iOS 26 that is Apple's real Liquid Glass bar; below
iOS 26 it is the standard tab bar.

- **The ＋** can't sit between two system tab items. It is a `role: 'search'`,
  `preventsDefault` route, which UIKit draws as a separate glass circle beside
  the bar (the Music / Photos layout). Tapping it fires `onIndexChange` without
  switching tabs, and we open the Entry sheet.
- **Web and Android** keep the custom `TabBar` (with the lens fix).
  `NATIVE_TABS` in `nav/nativeTabs.ts` is `Platform.OS === 'ios'`.
- **`NativeTabHost.web.tsx`** is a stub. The library imports
  `codegenNativeComponent`, which breaks `expo export --platform web` if bundled.
- **Jest:** `jest.setup.js` pins `NATIVE_TABS` to false, so the suite exercises
  the JS bar. `NativeTabHost.test.tsx` covers the native host with a JS stand-in
  for the library.

## Consequences

- We stop hand-tuning glass on iOS. Change the bar's look through the library's
  props (tint, labels, SF Symbols), not custom drawing.
- The ＋ is no longer centred between the tabs on iOS. That's an accepted
  trade-off for the native bar.
- Web can't show the iOS bar. Visual checks of it need an iOS build.
- **Open risks, check on device:** the Entry sheet must present above the
  native bar; tab bodies must not hide content behind the bar (each scene is
  padded by `useBottomTabBarHeight()`).
- **If it still doesn't feel right:** the agreed fallback is to revert to the
  pre-#140 flat, opaque bar, not to resume faking glass.
