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
  BottomSheetModal,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
} from 'react-native-reanimated';
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

// Dimmed strip left above the sheet's top edge (#63). The sheet caps its height
// at (container height − this) so a backdrop tap always has somewhere to land
// and tall content scrolls inside the sheet instead of overflowing past the
// frame bottom (Settings/Budgets otherwise measured ~1072px and ran off-screen).
// Kept modest so a tall phone still shows most Settings sections — through the
// Budgets row — without scrolling (issue #61 acceptance); shorter phones scroll.
const SHEET_TOP_STRIP = 44;

// The web AppShell (nav/AppShell.tsx) centers the app in a phone frame inset by
// 24px backdrop padding + a 1px border on every side; the sheet's gorhom
// container is that frame, not the whole window. Native has no such frame — the
// container is the window minus the top safe-area inset (the TabBar owns the
// bottom edge). Keep this in sync with AppShell's `webBackdrop` padding.
const WEB_FRAME_INSET = 2 * (24 + 1);

// accessibilityLabel we pin on gorhom's full-screen sheet-content container so
// the web CSS below can target it (gorhom's default label is "Bottom Sheet").
const SHEET_SURFACE_LABEL = 'sheet-surface';

// react-native-web renders gorhom's `pointerEvents="box-none"` sheet container
// as plain `pointer-events: auto`, so that full-screen container swallows every
// tap outside the sheet body — during a dismiss animation it eats the immediate
// reopen (＋) / swap (⚙) tap and the sheet looks wedged shut (#63; native is
// fine, box-none works there). Restore true box-none on web: the container
// passes taps through, only its sheet-body child captures. Injected once.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'kaji-sheet-boxnone';
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent =
      `[aria-label="${SHEET_SURFACE_LABEL}"]{pointer-events:none!important}` +
      `[aria-label="${SHEET_SURFACE_LABEL}"]>*{pointer-events:auto}`;
    document.head.appendChild(el);
  }
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Custom sheet handle: forgiving touch target (#69). Wraps gorhom's default
 * indicator pill (same visual size) inside a full-sheet-width, ~40px-tall
 * transparent band. The generous band makes drag-to-dismiss easy; the tap area
 * covers the full width so users don't need to aim. The band sits above the
 * sheet header (title / ✕ button), not overlapping it.
 */
function SheetHandle() {
  const { colors } = useTheme();
  return (
    <Pressable
      style={styles.handleBand}
      // Gesture is handled by gorhom's modal; this Pressable just expands the tap target.
      hitSlop={0}
    >
      <View style={[styles.handlePill, { backgroundColor: colors.line }]} />
    </Pressable>
  );
}

/**
 * The dimmed backdrop, tap-to-close. Custom (not gorhom's BottomSheetBackdrop)
 * to fix the "ghost backdrop" that made sheets seem un-reopenable (#63):
 * gorhom's backdrop keeps `pointerEvents: 'auto'` for the *entire* fade-out
 * animation — it only lets go once its index reaches −1 (~600ms after a close
 * begins). During that window an immediate reopen (＋) or swap (⚙) tap lands on
 * the fading backdrop and is swallowed, so nav never changes and the sheet looks
 * wedged shut (invisible on dev web, where animations are instant).
 *
 * Here `pointerEvents` is driven off `animatedIndex` on the UI thread and drops
 * to 'none' the instant the sheet starts descending from rest (index < ~0), so
 * the very next tap passes straight through to the FAB/gear underneath. Opacity
 * still fades smoothly over the whole close. The tap routes through `onClose`
 * (not gorhom's own close) so a backdrop dismiss takes the same app-driven path
 * as the ✕ button, which the sheet host's phase machine reconciles.
 */
function SheetBackdrop({
  animatedIndex,
  style,
  onClose,
}: BottomSheetBackdropProps & { onClose: () => void }) {
  // At rest the sheet sits at index 0; any descent toward −1 is a close.
  const [interactive, setInteractive] = useState(false);
  useAnimatedReaction(
    () => animatedIndex.value > -0.02,
    (open, prev) => {
      if (open !== prev) runOnJS(setInteractive)(open);
    },
    [],
  );
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [-1, 0], [0, 0.5], Extrapolation.CLAMP),
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Bottom sheet backdrop"
      onPress={onClose}
      pointerEvents={interactive ? 'auto' : 'none'}
      style={[style, styles.backdrop, animatedStyle]}
    />
  );
}

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
  const { height: windowHeight } = useWindowDimensions();
  // Three-phase lifecycle so present()/dismiss() never race gorhom's async
  // animation (#63). 'dismissing' means we asked gorhom to close and are waiting
  // for its onDismiss; we must NOT present() again until then, or gorhom drops
  // the call and the sheet wedges shut (the "never reopens" bug).
  const [phase, setPhase] = useState<'closed' | 'open' | 'dismissing'>('closed');

  // Height the sheet caps at: the container (frame on web, window−safe-area on
  // native) minus the dimmed top strip. gorhom is told the same cap via
  // `maxDynamicContentSize` so its measured detent matches, and the content
  // view carries it as `maxHeight` so tall bodies clip to it and their inner
  // BottomSheetScrollView scrolls the overflow (#63).
  const containerHeight =
    Platform.OS === 'web' ? windowHeight - WEB_FRAME_INSET : windowHeight - insets.top;
  const maxSheetHeight = Math.max(MIN_CONTENT_HEIGHT, containerHeight - SHEET_TOP_STRIP);

  // Snappy open/close. Beyond feel, a short close shrinks the window in which
  // gorhom's full-screen sheet container (whose `pointerEvents="box-none"` does
  // not pass through on react-native-web) sits over the FAB/gear and eats an
  // immediate reopen/swap tap — the last piece of the "sheets never reopen" bug
  // (#63). The phase machine then re-presents once that tap lands.
  const animationConfigs = useBottomSheetTimingConfigs({ duration: 200 });

  // Always-current mirror of `visible` for the async onDismiss handler, which
  // fires from a stale render closure and so cannot read `visible` directly.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  // Set while the visibility effect below is the one closing the sheet (an
  // app-driven close: ✕ button, backdrop tap, or a swap to another sheet all
  // route through onClose → setSheet(null) → here). Lets onDismiss tell that
  // apart from a user pan-down, which gorhom initiates on its own.
  const selfDismissing = useRef(false);

  // Reconcile gorhom's presented state with nav (#60/#63). Present when a sheet
  // is wanted and none is up; dismiss when nav cleared it. Crucially, while
  // 'dismissing' we do nothing and wait for onDismiss to flip us to 'closed',
  // which re-runs this effect — so a reopen or swap requested mid-dismiss is
  // presented cleanly *after* the old sheet finishes closing, not dropped into
  // the animation. Non-null→non-null transitions (entry→settings) keep `visible`
  // true and `phase` 'open', so the sheet stays up and just swaps children.
  useEffect(() => {
    if (visible && phase === 'closed') {
      ref.current?.present();
      setPhase('open');
    } else if (!visible && phase === 'open') {
      selfDismissing.current = true;
      ref.current?.dismiss();
      setPhase('dismissing');
    }
  }, [visible, phase]);

  // gorhom fires onDismiss only when the dismiss animation finishes — long after
  // nav changed, possibly after the user reopened. So this must never blindly
  // re-close: it flips phase to 'closed', letting the effect above re-present if
  // nav now wants a sheet (the reopen/swap paths). The one case needing a nav
  // sync is a *user* pan-down — gorhom closed without routing through onClose, so
  // nav is stale-open; we detect it as "not a self-dismiss" and close nav then.
  const handleDismiss = useCallback(() => {
    const wasSelfDismiss = selfDismissing.current;
    selfDismissing.current = false;
    setPhase('closed');
    if (!wasSelfDismiss && visibleRef.current) {
      onClose();
    }
  }, [onClose]);

  // Dimmed backdrop; tap dismisses through onClose (the app-driven path, same as
  // the ✕ button). See SheetBackdrop for why it's a custom component rather than
  // gorhom's BottomSheetBackdrop (#63 ghost-backdrop fix).
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <SheetBackdrop {...props} onClose={onClose} />,
    [onClose],
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
      maxDynamicContentSize={maxSheetHeight}
      animationConfigs={animationConfigs}
      accessibilityLabel={SHEET_SURFACE_LABEL}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[
        styles.sheet,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      handleComponent={SheetHandle}
    >
      {/* Pre-flattened to ONE object: gorhom spreads array styles into
          StyleSheet.compose(...), which react-native-web throws on in dev when
          given >2 elements and native/prod silently truncates to 2 — either
          way a 3-element array here breaks every sheet open on web. */}
      <BottomSheetView
        testID={testID}
        style={StyleSheet.flatten([
          styles.content,
          { minHeight: MIN_CONTENT_HEIGHT, maxHeight: maxSheetHeight, paddingBottom: 28 + insets.bottom },
          style,
        ])}
      >
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  // Dimmed scrim behind the sheet; opacity is animated per-frame (SheetBackdrop).
  backdrop: { backgroundColor: '#000' },
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
    // paddingBottom is set dynamically to include bottom safe-area inset (#69)
  },
  // Custom drag handle with forgiving touch target (#69)
  handleBand: {
    height: 40,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handlePill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
