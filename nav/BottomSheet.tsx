/**
 * BottomSheet — the Entry and Settings sheets (decision 3), migrated onto
 * `@gorhom/bottom-sheet` in #39. Opens at content height with a softly fading
 * dimmed backdrop and a spring-driven slide, replacing the old squared-off RN
 * `Modal` (`animationType="slide"`). Tapping the backdrop — or dragging the
 * sheet down — dismisses it; the rounded top corners are kept throughout.
 *
 * The parent still owns which sheet is open, so this stays a controlled
 * component: the boolean `visible` prop is mirrored onto the modal's imperative
 * present()/dismiss() below, and `onClose` fires whenever the sheet leaves.
 *
 * Mounting contract (#47): `children` must be passed unconditionally — never
 * gated on `visible` by the parent. `enableDynamicSizing` measures the content
 * at present() time to derive the resting detent, so content that mounts only
 * after `visible` flips can present a blank, zero-height sheet. The modal
 * itself portals children in on present() and unmounts them after dismiss, so
 * each open still gets a fresh mount (state re-initializes per open).
 *
 * Snap detents (#44): every sheet now exposes two — content height (resting,
 * dynamic) and full screen (`100%`) — so `enableDynamicSizing` pushes its
 * measured content-height detent in alongside the fixed one. Dragging the
 * handle up/down past a threshold snaps between them or dismisses; that's all
 * built into `@gorhom/bottom-sheet`, no extra wiring needed here.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  useBottomSheetInternal,
  INITIAL_LAYOUT_VALUE,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, metrics } from '../theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Extra style for the sheet content (e.g. min height). */
  style?: StyleProp<ViewStyle>;
  /**
   * Entry sheet only (#44): at full screen, slide the whole (otherwise
   * untouched) content block down by however much taller the sheet has grown
   * so the keypad/CTA/option rows stay pinned to the bottom and the revealed
   * background above the amount/category area reads as breathing room — no
   * reflow, nothing shifts under the thumb. A `transform`, not a layout
   * change, so it never feeds back into the dynamic content-height
   * measurement that sizes the resting detent.
   */
  anchorBottom?: boolean;
}

// The dynamic (content-height) detent from `enableDynamicSizing` is inserted
// alongside this fixed one, sorted by position — giving every sheet its two
// detents (resting + full) without hand-computing either.
const SNAP_POINTS = ['100%'];

export function BottomSheet({
  visible,
  onClose,
  children,
  style,
  anchorBottom,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const ref = useRef<BottomSheetModal>(null);
  // Keep the full-height detent below the status bar (#47): the modal's
  // container spans the whole window, so without this the sheet's top row
  // (e.g. Settings' Done button) lands under the status bar at `100%`.
  const insets = useSafeAreaInsets();

  // Mirror the controlled `visible` prop onto the imperative modal. dismiss()
  // animates out and then fires onDismiss (below); present() is a no-op if it's
  // already up, and vice-versa, so re-runs are safe.
  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  // Dimmed backdrop that fades in as the sheet rises and out as it leaves; a tap
  // closes it, matching the old Pressable backdrop.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      enablePanDownToClose
      topInset={insets.top}
      snapPoints={SNAP_POINTS}
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        styles.sheet,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      handleIndicatorStyle={{ backgroundColor: colors.line }}
    >
      {anchorBottom ? (
        <AnchoredContent style={[styles.content, style]}>{children}</AnchoredContent>
      ) : (
        <BottomSheetView style={[styles.content, style]}>{children}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

function AnchoredContent({
  style,
  children,
}: {
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const { animatedPosition, animatedLayoutState } = useBottomSheetInternal();

  // extra = how much taller the sheet currently is than its resting content
  // height. 0 at rest (no-op), growing toward full screen as the handle is
  // dragged up; sliding by this amount keeps the block's internal layout
  // completely untouched.
  const slide = useAnimatedStyle(() => {
    const { containerHeight, handleHeight, contentHeight } = animatedLayoutState.get();
    if (
      containerHeight === INITIAL_LAYOUT_VALUE ||
      handleHeight === INITIAL_LAYOUT_VALUE ||
      contentHeight === INITIAL_LAYOUT_VALUE
    ) {
      return {};
    }
    const extra = containerHeight - animatedPosition.get() - handleHeight - contentHeight;
    return { transform: [{ translateY: Math.max(0, extra) }] };
  });

  return (
    <Animated.View style={[styles.anchoredWrap, slide]}>
      <BottomSheetView style={style}>{children}</BottomSheetView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Rounded top corners only (kept through the animation via backgroundStyle),
  // with the same hairline border the RN Modal card carried.
  sheet: {
    borderTopLeftRadius: metrics.sheetRadius,
    borderTopRightRadius: metrics.sheetRadius,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: metrics.screenPadX,
    paddingTop: 4,
    paddingBottom: 28,
  },
  // Matches BottomSheetView's own default positioning (it's always absolute,
  // top/left/right: 0) so the anchored variant lays out identically at rest;
  // `slide` above then offsets it downward as the sheet grows past that.
  anchoredWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
