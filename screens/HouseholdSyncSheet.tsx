import React, { type ComponentType, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { strings } from '../i18n';
import { syncFailureMessage, type SyncHistoryRow, type SyncStatusModel } from '../domain';
import { IconButton } from '../nav/IconButton';
import { metrics, Txt, useTheme } from '../theme';

interface ScrollContainerProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  children: ReactNode;
}

export interface HouseholdSyncSheetProps {
  model: SyncStatusModel;
  history: SyncHistoryRow[];
  onSyncNow: () => void;
  onRestore: (transactionId: string, operationId: string) => void;
  onClose: () => void;
  ScrollContainer?: ComponentType<ScrollContainerProps>;
}

const statusLabel = {
  paired: strings.sync.paired,
  offline: strings.sync.offline,
  syncing: strings.sync.syncing,
  error: strings.sync.error,
} as const;

const changeLabel = {
  added: strings.sync.added,
  edited: strings.sync.edited,
  deleted: strings.sync.deleted,
} as const;

export function HouseholdSyncSheet({
  model,
  history,
  onSyncNow,
  onRestore,
  onClose,
  ScrollContainer = ScrollView as ComponentType<ScrollContainerProps>,
}: HouseholdSyncSheetProps) {
  const { colors } = useTheme();
  const statusMessage = model.syncNow === 'partner-absent'
    ? strings.sync.partnerAbsent
    : model.syncNow === 'not-paired' ? strings.sync.notPaired : strings.sync.nearbyOnly;
  const failureMessage = model.error ? syncFailureMessage(model.error) : null;

  return (
    <View style={styles.container} testID="household-sync-surface">
      <View style={styles.header}>
        <Txt variant="screenTitle">{strings.settings.householdSync}</Txt>
        <IconButton name="x" accessibilityLabel={strings.nav.close} onPress={onClose} />
      </View>
      <ScrollContainer style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusCard, { backgroundColor: colors.card2 }]} accessibilityRole="summary">
          <View style={styles.statusRow}>
            <Txt variant="listItem" tone="ink">{statusLabel[model.status]}</Txt>
            <Txt variant="microLabel" tone={model.status === 'error' ? 'negative' : 'positive'}>
              {model.queuedOperationCount > 0 ? `${model.queuedOperationCount}` : ''}
            </Txt>
          </View>
          <Txt variant="secondary" tone="muted">{strings.sync.lastSynced}: {model.lastSyncedAt ?? strings.sync.neverSynced}</Txt>
          <Txt variant="secondary" tone="muted" style={styles.notice}>{failureMessage?.message ?? statusMessage}</Txt>
          <Pressable
            onPress={onSyncNow}
            accessibilityRole="button"
            accessibilityLabel={strings.sync.syncNow}
            style={[styles.syncButton, { backgroundColor: colors.positive }]}
          >
            <Txt variant="listItem" tone="onPositive">{strings.sync.syncNow}</Txt>
          </Pressable>
        </View>

        <Txt variant="microLabel" tone="dim" style={styles.section}>{strings.sync.history}</Txt>
        {history.length === 0 ? (
          <Txt variant="secondary" tone="muted">{strings.sync.noHistory}</Txt>
        ) : history.map((row) => (
          <View key={`${row.transactionId}:${row.operationId}`} style={[styles.historyRow, { borderBottomColor: colors.hair }]}>
            <View style={styles.historyCopy}>
              <Txt variant="listItem" tone="ink">{changeLabel[row.change]}</Txt>
              <Txt variant="secondary" tone="muted">{strings.sync.by(row.actorId)}</Txt>
              {row.transaction && (
                <Txt variant="secondary" tone="muted" numberOfLines={1}>
                  {row.transaction.category} · {row.transaction.amount}
                </Txt>
              )}
            </View>
            {row.transaction && (
              <Pressable
                onPress={() => onRestore(row.transactionId, row.operationId)}
                accessibilityRole="button"
                accessibilityLabel={`${strings.sync.restore}: ${changeLabel[row.change]}`}
                style={[styles.restoreButton, { borderColor: colors.border }]}
              >
                <Txt variant="microLabel" tone="ink">{strings.sync.restore}</Txt>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 28, gap: 12 },
  statusCard: { borderRadius: metrics.cardRadius, padding: 16, gap: 10 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notice: { lineHeight: 20 },
  syncButton: { minHeight: 44, borderRadius: metrics.iconTileRadius, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: 10 },
  historyRow: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyCopy: { flex: 1, gap: 2 },
  restoreButton: { minHeight: 36, paddingHorizontal: 10, borderWidth: 1, borderRadius: metrics.iconTileRadius, justifyContent: 'center' },
});
