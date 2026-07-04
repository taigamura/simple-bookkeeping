/**
 * LockGate — the app-root auth gate (#30). When `enabled`, hides `children`
 * behind expo-local-authentication (biometrics falling back to the device
 * passcode) on mount; a failed/canceled attempt leaves an "Unlock" retry
 * rather than locking the user out permanently. Disabled, or on web (no
 * native prompt there), it renders `children` straight through.
 */
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { strings } from '../i18n';
import * as auth from '../platform/auth';
import { useTheme, accents, Txt } from '../theme';

interface LockGateProps {
  enabled: boolean;
  children: React.ReactNode;
}

export function LockGate({ enabled, children }: LockGateProps) {
  const gated = enabled && Platform.OS !== 'web';
  const [unlocked, setUnlocked] = useState(!gated);

  const attempt = () => {
    auth.authenticate(strings.lock.prompt).then((success) => {
      if (success) setUnlocked(true);
    });
  };

  useEffect(() => {
    if (!gated) {
      setUnlocked(true);
      return;
    }
    setUnlocked(false);
    attempt();
    // Only re-run when the gate itself toggles on/off — not on every render.
    // (attempt() is intentionally excluded from the dependency list.)
  }, [gated]);

  if (unlocked) return <>{children}</>;

  return <LockedScreen onRetry={attempt} />;
}

function LockedScreen({ onRetry }: { onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Txt variant="screenTitle">{strings.lock.lockedTitle}</Txt>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={strings.lock.unlockButton}
        style={[styles.button, { backgroundColor: accents.positive }]}
      >
        <Txt variant="listItem" tone="onPositive">
          {strings.lock.unlockButton}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  button: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
