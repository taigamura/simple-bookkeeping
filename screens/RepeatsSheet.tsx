import React, { type ComponentType, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  activeRecurrences,
  signed,
  type RecurrenceDate,
  type RecurrenceRule,
  type Transaction,
} from '../domain';
import { strings } from '../i18n';
import { IconButton } from '../nav/IconButton';
import { Txt, useTheme } from '../theme';

interface ScrollContainerProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  children: ReactNode;
}

interface RepeatsSheetProps {
  recurrenceRules: RecurrenceRule[];
  today: RecurrenceDate;
  symbol: string;
  onEdit: (entry: Transaction) => void;
  onDone: () => void;
  ScrollContainer?: ComponentType<ScrollContainerProps>;
}

export function RepeatsSheet({
  recurrenceRules,
  today,
  symbol,
  onEdit,
  onDone,
  ScrollContainer = ScrollView as ComponentType<ScrollContainerProps>,
}: RepeatsSheetProps) {
  const { colors } = useTheme();
  const active = activeRecurrences(recurrenceRules, today);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton name="chevron-left" accessibilityLabel={strings.nav.back} onPress={onDone} />
        <Txt variant="screenTitle">{strings.repeats.title}</Txt>
      </View>
      <ScrollContainer
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {active.length === 0 ? (
          <View style={styles.empty}>
            <Txt variant="listItem" tone="ink">{strings.repeats.emptyTitle}</Txt>
            <Txt variant="secondary" tone="dim">{strings.repeats.emptyMessage}</Txt>
          </View>
        ) : (
          <View style={[styles.list, { backgroundColor: colors.card2 }]}>
            {active.map(({ rule, next }, index) => {
              const name = rule.note === '—' || rule.note.trim() === '' ? rule.category : rule.note;
              const date = strings.repeats.date(next.y, next.m, next.day);
              const cutoff = rule.endsBefore?.split('-').map(Number);
              return (
                <Pressable
                  key={rule.id}
                  onPress={() => onEdit(next)}
                  accessibilityRole="button"
                  accessibilityLabel={strings.repeats.editRepeat(name)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.hair,
                    },
                    pressed && { backgroundColor: colors.card3 },
                  ]}
                >
                  <View style={styles.rowCopy}>
                    <Txt variant="listItem" tone="ink" numberOfLines={1}>{name}</Txt>
                    <Txt variant="secondary" tone="dim">
                      {strings.entry.repeatLabels[rule.repeat]} · {strings.repeats.next(date)}
                    </Txt>
                    {cutoff && (
                      <Txt variant="secondary" tone="dim">
                        {strings.repeats.endsBefore(
                          strings.repeats.date(cutoff[0], cutoff[1] - 1, cutoff[2]),
                        )}
                      </Txt>
                    )}
                  </View>
                  <Txt variant="inlineAmount" tone={rule.type === 'income' ? 'positive' : 'muted'}>
                    {signed(rule.type === 'income' ? rule.amount : -rule.amount, symbol)}
                  </Txt>
                  <Txt variant="listItem" tone="dim">›</Txt>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4, flexShrink: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  scroll: { flex: 1, minHeight: 0 },
  scrollBody: { paddingBottom: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 20 },
  list: { borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowCopy: { flex: 1, gap: 4 },
});
