# Gesture + animation foundation: migrate sheets to @gorhom/bottom-sheet

> GitHub issue #39 | Labels: ready-for-agent, P0 | https://github.com/taigamura/simple-bookkeeping/issues/39

## Parent

#31 — Device polish: calendar grid, bottom-edge layout, gesture sheets, entry edit/delete, month swipe

## What to build

The gesture/animation keystone for the whole "device polish" release. Adopt `@gorhom/bottom-sheet` (which pulls in `react-native-gesture-handler` and `react-native-reanimated`) as the shared foundation that later powers both the sheets and the calendar month-swipe. Because these are native modules, this release ships as a **fresh EAS native build, not an Expo OTA update**.

Then migrate the existing Entry and Settings sheets off the plain RN `Modal` and onto `@gorhom/bottom-sheet`, opening at **content height** with a smoothly fading dimmed backdrop and a spring-driven slide — retiring the old "squared-off" `Modal` (`animationType="slide"`) animation and, with it, fixing the awkward ＋ menu motion. The sheet's rounded top corners are preserved throughout.

**Web parity is a gating step, not an afterthought.** The same stack runs on react-native-web in one code path, and the sheets must stay clipped inside the existing 402px phone-frame column (the frame already sets `overflow: hidden`). Verify on device and in the browser before this is considered done; mouse-drag feel may be slightly less crisp than on device.

This slice keeps the sheets' current single resting behavior — the two-detent drag-to-dismiss/drag-to-full snapping is a separate follow-up slice.

## Acceptance criteria

- [ ] `@gorhom/bottom-sheet`, `react-native-gesture-handler`, and `react-native-reanimated` are installed at versions compatible with Expo SDK 57 / RN 0.86
- [ ] The reanimated Babel plugin is configured, the app is wrapped in `GestureHandlerRootView`, and the gesture-handler side-effect import is at the top of the app entry
- [ ] Both the Entry and Settings sheets render via `@gorhom/bottom-sheet` at content height, replacing the RN `Modal`
- [ ] Opening a sheet shows a softly fading dimmed backdrop and a spring slide; the ＋ menu no longer animates hard-edged/"squared off"
- [ ] The sheet's rounded top corners are preserved during the animation
- [ ] On web, sheets and their backdrop stay clipped inside the 402px phone frame
- [ ] Verified working on device (via a fresh EAS build) and in the browser
- [ ] A fresh EAS native build is produced (this cannot ship as an OTA update)

## Blocked by

- None - can start immediately

