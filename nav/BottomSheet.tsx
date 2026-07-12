/**
 * BottomSheet — unified sheet host for entry/settings/budgets (#60), migrated
 * onto `@gorhom/bottom-sheet` in #39. Opens at content height with a softly fading
 * dimmed backdrop and a spring-driven slide. Tapping the backdrop — or dragging
 * the sheet handle down — dismisses it; rounded top corners persist.
 *
 * Controlled component: the boolean `visible` prop mirrors onto present()/dismiss(),
 * but transitions between non-null content (entry→settings, etc.) stay open —
 * only null transitions trigger present/dismiss.
 *
 * Mounting contract (#47): `children` must be passed unconditionally. The modal
 * measures content at present() time for dynamic sizing, so content that mounts
 * only after `visible` flips would present blank. The gorhom modal portals
 * children while presented and unmounts after dismiss, refreshing state per open.
 *
 * Minimum height floor (#60): prevents a zero-measurement from presenting an
 * invisible sheet. If content height falls below the floor, the sheet uses the
 * floor instead, guaranteeing visibility.
 *
 * Single content-height detent (#54): only dynamic content-height, no full-screen
 * snap. Content panning is disabled; sheets drag only via the handle or close
 * via backdrop tap/Done buttons, so in-sheet scrollables never compete with pan.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, metrics } from '../theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Extra style for the sheet content (e.g. min height). */
  style?: StyleProp<ViewStyle>;
  /** Anchor for the e2e suite (#58) — lands on the sheet's content view. */
  testID?: string;
}

// Empty snap points array: only the dynamic content-height detent from
// `enableDynamicSizing` is used (#54). No fixed full-screen detent.
const SNAP_POINTS: number[] = [];

// Minimum content height (#60): if the sheet content measures below this,
// use this floor instead to guarantee visibility. Prevents zero-height sheets.
const MIN_CONTENT_HEIGHT = 200;

export function BottomSheet({
  visible,
  onClose,
  children,
  style,
  testID,
}: BottomSheetProps) {
  const { colors } = useTheme();
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const [isPresented, setIsPresented] = useState(false);

  // Content-swap handler (#60): only present/dismiss on visibility transitions.
  // When sheet state changes from one non-null value to another (entry→settings),
  // the sheet stays open and just re-measures the new content. This avoids the
  // dismiss/present race that plagued the old three-modal setup (#53/#54).
  useEffect(() => {
    if (visible && !isPresented) {
      ref.current?.present();
      setIsPresented(true);
    } else if (!visible && isPresented) {
      ref.current?.dismiss();
      setIsPresented(false);
    }
  }, [visible, isPresented]);

  // Reconciliation handler (#60): if the modal dismisses while nav state still
  // says the sheet should be open, re-present it. This ensures nav state is
  // authoritative and prevents the dead state where sheet→null but the modal
  // closed, leaving re-taps silent.
  const handleDismiss = useCallback(() => {
    setIsPresented(false);
    // If visible is still true, the nav state says the sheet should be open.
    // The dismissal was spurious (not user-initiated), so re-present.
    if (visible) {
      setTimeout(() => ref.current?.present(), 0);
      setIsPresented(true);
    } else {
      // User-initiated dismissal: call the callback.
      onClose();
    }
  }, [visible, onClose]);

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
      enableHandlePanningGesture
      enableContentPanningGesture={false}
      topInset={insets.top}
      snapPoints={SNAP_POINTS}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        styles.sheet,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      handleIndicatorStyle={{ backgroundColor: colors.line }}
    >
      {/* Pre-flattened to ONE object: gorhom spreads array styles into
          StyleSheet.compose(...), which react-native-web throws on in dev when
          given >2 elements and native/prod silently truncates to 2 — either
          way a 3-element array here breaks every sheet open on web. */}
      <BottomSheetView
        testID={testID}
        style={StyleSheet.flatten([styles.content, { minHeight: MIN_CONTENT_HEIGHT }, style])}
      >
        {children}
      </BottomSheetView>
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
