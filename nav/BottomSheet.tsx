/**
 * BottomSheet — the Entry and Settings sheets (decision 3), migrated onto
 * `@gorhom/bottom-sheet` in #39. Opens at content height with a softly fading
 * dimmed backdrop and a spring-driven slide, replacing the old squared-off RN
 * `Modal` (`animationType="slide"`). Tapping the backdrop — or dragging the
 * sheet handle down — dismisses it; the rounded top corners are kept throughout.
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
 * Single content-height detent (#54): sheets now expose only the dynamic
 * content-height detent — no full-screen (100%) snap or grow gesture. Content
 * panning is disabled; sheets are dragged only via the grab handle or dismissed
 * via backdrop tap/Done buttons, so in-sheet scroll areas never compete with
 * pan recognizers. Scrollables (Settings/Budgets category lists, Data actions)
 * work at the top detent, making full content reachable within the kept ~460
 * scroll cap.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, metrics } from '../theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Extra style for the sheet content (e.g. min height). */
  style?: StyleProp<ViewStyle>;
}

// Empty snap points array: only the dynamic content-height detent from
// `enableDynamicSizing` is used (#54). No fixed full-screen detent.
const SNAP_POINTS: number[] = [];

export function BottomSheet({
  visible,
  onClose,
  children,
  style,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const ref = useRef<BottomSheetModal>(null);
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
      enableContentPanningGesture={false}
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
      <BottomSheetView style={[styles.content, style]}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
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
