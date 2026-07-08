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
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, metrics } from '../theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Extra style for the sheet content (e.g. min height). */
  style?: StyleProp<ViewStyle>;
}

export function BottomSheet({ visible, onClose, children, style }: BottomSheetProps) {
  const { colors } = useTheme();
  const ref = useRef<BottomSheetModal>(null);

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
      // No snapPoints → dynamic sizing measures the content and opens at its
      // natural height (the sheets' single resting position; the two-detent
      // drag-to-full snapping is a later slice).
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        styles.sheet,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      handleIndicatorStyle={{ backgroundColor: colors.line }}
    >
      <BottomSheetView style={[styles.content, style]}>{children}</BottomSheetView>
    </BottomSheetModal>
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
});
