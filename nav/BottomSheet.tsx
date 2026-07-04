/**
 * BottomSheet — the Entry and Settings sheets (decision 3). A plain RN `Modal`
 * (`animationType="slide"`, transparent) over a dimmed backdrop; tapping the
 * backdrop dismisses. The sheet is a rounded card pinned to the bottom with a
 * grab handle. No react-navigation — the root owns which sheet is open.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { strings } from '../i18n';
import { useTheme, metrics } from '../theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Extra style for the sheet card (e.g. min height). */
  style?: StyleProp<ViewStyle>;
}

export function BottomSheet({ visible, onClose, children, style }: BottomSheetProps) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* Backdrop: fills the frame behind the sheet; tap to dismiss. */}
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={strings.nav.close}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
            style,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.line }]} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,.5)',
  },
  sheet: {
    borderTopLeftRadius: metrics.sheetRadius,
    borderTopRightRadius: metrics.sheetRadius,
    borderWidth: 1,
    paddingHorizontal: metrics.screenPadX,
    paddingBottom: 28,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: metrics.pill,
    marginBottom: 14,
  },
});
