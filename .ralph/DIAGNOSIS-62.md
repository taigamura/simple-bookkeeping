# Issue #62 Diagnosis: Dead Grab Bar Pan Gesture

## Problem Statement
Build 7 device: dragging the sheet's grab handle produces no movement at all — the handle's pan gesture receives no touches.

## Root Cause Analysis

### Investigation Process

1. **gorhom/bottom-sheet Handle Implementation**: Examined `BottomSheetHandleContainer.tsx` in the gorhom/bottom-sheet library (v5.2.14). The handle gesture is configured using:
   - `Gesture.Pan()` from `react-native-gesture-handler` (v2.32.0)
   - Wrapped in `GestureDetector` component
   - Controlled by `enableHandlePanningGesture` prop (default: `true`)

2. **Current Configuration**: The BottomSheet.tsx was missing an **explicit** `enableHandlePanningGesture` prop on the BottomSheetModal component, relying on the default value.

3. **Dependency Compatibility**: Current versions:
   - react-native: 0.86.0 (recent, may have New Architecture changes)
   - react-native-gesture-handler: ~2.32.0
   - react-native-reanimated: ^4.5.0
   - @gorhom/bottom-sheet: ^5.2.14

### Suspected Issue
The combination of recent RN 0.86 and gesture-handler 2.32 may have introduced a regression in how `GestureDetector` registers pan gestures on the handle. The default value being relied upon implicitly may not be sufficient in this specific dependency configuration.

## Fix Applied

Added explicit `enableHandlePanningGesture` prop to BottomSheetModal in `nav/BottomSheet.tsx`:

```tsx
<BottomSheetModal
  ref={ref}
  enableDynamicSizing
  enablePanDownToClose
  enableHandlePanningGesture  // ← Added explicit enable
  enableContentPanningGesture={false}
  // ... rest of props
>
```

This ensures that:
1. The handle panning gesture is explicitly enabled (not relying on defaults)
2. The gesture configuration is visible in the component props
3. The GestureDetector in BottomSheetHandleContainer receives the correct enabled state

## Verification Steps (Device Testing)

### On Physical iPhone:
1. Open any sheet (Entry, Settings, Budgets)
2. **Grab bar drag test**: Touch and drag the grab bar handle downward
   - ✓ Sheet should visibly follow the finger during drag
   - ✓ Sheet should dismiss when finger is released after sufficient downward movement
3. **Fling test**: Quick downward swipe on the grab bar
   - ✓ Sheet should dismiss with momentum/spring animation
4. **Backdrop tap test**: 
   - ✓ Tapping the dimmed backdrop should still dismiss the sheet
   - ✓ All three dismissal paths (grab bar drag, fling, backdrop tap) should work

### If Still Failing
If the handle still doesn't respond after this change, the issue likely indicates:
- A deeper incompatibility between gesture-handler 2.32.x and RN 0.86.x
- Possible New Architecture (Fabric) enabling that breaks gesture routing
- This would trigger the PRD fallback: replace gorhom/bottom-sheet with RN's native Modal

## Related Issues
- Blocked by: #60 (sheet dismissal reconciliation)
- Relates to: #61 (sheet sizing), #58 (e2e suite)
- PRD fallback reference: #57

## Next Steps
1. Test on Build 7 device physical iPhone
2. If grab bar responds to drag: flip `test.fail()` marker in e2e suite for this scenario
3. If grab bar still unresponsive: surface to maintainer for Modal fallback decision
