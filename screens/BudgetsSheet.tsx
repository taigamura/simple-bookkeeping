/**
 * BudgetsSheet — the Budgets sheet body (#49), reached by drilling in from the
 * Settings sheet (the sheets swap; they never stack). One row per *expense*
 * category: code tile + label + the chosen currency symbol + a numeric amount
 * field. Typing an amount stores that category's recurring monthly budget;
 * blanking the field clears it. "Done" returns to Settings via `onDone`.
 *
 * Presentational only: `budgets` comes in as a prop and every edit is pushed
 * straight back up through `onChangeBudgets` (the parent persists), using the
 * pure `setBudget`/`clearBudget` domain transforms.
 *
 * `ScrollContainer` defaults to RN's plain `ScrollView` for standalone tests;
 * the real app swaps in `BottomSheetScrollView` (same seam as SettingsSheet).
 */
import React, { useState, type ComponentType, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  AMOUNT_MAX_DIGITS,
  clearBudget,
  code,
  setBudget,
  type Budgets,
} from '../domain';
import { strings } from '../i18n';
import { useTheme, metrics, Txt } from '../theme';

/** Minimal shape shared by RN's `ScrollView` and gorhom's `BottomSheetScrollView`. */
interface ScrollContainerProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  children: ReactNode;
}

interface BudgetsSheetProps {
  expCats: string[];
  budgets: Budgets;
  symbol: string;
  onChangeBudgets: (budgets: Budgets) => void;
  /** The Done button — returns to the Settings sheet, not plain close. */
  onDone: () => void;
  /** Scrollable wrapper for the rows below the header; see file header. */
  ScrollContainer?: ComponentType<ScrollContainerProps>;
}

export function BudgetsSheet({
  expCats,
  budgets,
  symbol,
  onChangeBudgets,
  onDone,
  ScrollContainer = ScrollView as ComponentType<ScrollContainerProps>,
}: BudgetsSheetProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Txt variant="screenTitle">{strings.budgets.title}</Txt>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel={strings.nav.done}
          hitSlop={8}
        >
          <Txt variant="listItem" tone="positive">
            {strings.nav.done}
          </Txt>
        </Pressable>
      </View>
      <ScrollContainer
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card2 }]}>
          {expCats.map((cat, i) => (
            <BudgetRow
              key={cat}
              category={cat}
              amount={budgets[cat]}
              symbol={symbol}
              divider={i > 0}
              onChange={(amount) =>
                onChangeBudgets(
                  amount === null
                    ? clearBudget(budgets, cat)
                    : setBudget(budgets, cat, amount),
                )
              }
            />
          ))}
        </View>
      </ScrollContainer>
    </View>
  );
}

/**
 * One category row. The field holds a digits-only local draft (the sheet body
 * remounts fresh per open, so seeding it from the stored budget once is safe);
 * every keystroke pushes the parsed amount up — `null` for a blanked field.
 */
function BudgetRow({
  category,
  amount,
  symbol,
  divider,
  onChange,
}: {
  category: string;
  amount: number | undefined;
  symbol: string;
  divider: boolean;
  onChange: (amount: number | null) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(amount !== undefined ? String(amount) : '');

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, AMOUNT_MAX_DIGITS);
    setDraft(digits);
    onChange(digits === '' ? null : parseInt(digits, 10));
  };

  return (
    <View
      style={[
        styles.row,
        divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair },
      ]}
    >
      <View style={[styles.codeTile, { backgroundColor: colors.card3 }]}>
        <Txt variant="microLabel" tone="muted">
          {code(category)}
        </Txt>
      </View>
      <Txt variant="listItem" tone="ink" style={styles.label} numberOfLines={1}>
        {category}
      </Txt>
      <Txt variant="listItem" tone={draft === '' ? 'dim' : 'muted'}>
        {symbol}
      </Txt>
      <TextInput
        value={draft}
        onChangeText={handleChange}
        keyboardType="number-pad"
        placeholder={strings.budgets.none}
        placeholderTextColor={colors.dim}
        accessibilityLabel={strings.budgets.budgetFor(category)}
        style={[styles.input, { backgroundColor: colors.card3, color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scroll: { maxHeight: 460 },
  scrollBody: { paddingBottom: 4 },
  card: {
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
  },
  codeTile: {
    width: 34,
    height: 34,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
  input: {
    width: 104,
    height: 38,
    borderRadius: metrics.iconTileRadius,
    paddingHorizontal: 10,
    fontSize: 14.5,
    textAlign: 'right',
  },
});
