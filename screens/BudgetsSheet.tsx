/**
 * BudgetsSheet — the Budgets sheet body (#49/#66), reached by drilling in from
 * the Settings sheet (the sheets swap; they never stack). A toggle at the top
 * switches between per-category mode (one row per *expense* category: code tile +
 * label + currency symbol + amount field) and total mode (a single amount field
 * for the whole month). Typing an amount stores the budget; blanking clears it.
 * "Done" returns to Settings via `onDone`. Switching modes preserves both the
 * per-category map and the total amount.
 *
 * Presentational only: budgets/mode/totalBudget come in as props and every edit
 * is pushed up through callbacks (the parent persists), using the pure
 * `setBudget`/`clearBudget` domain transforms.
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
import { IconButton } from '../nav/IconButton';
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
  budgetMode: 'category' | 'total';
  totalBudget: number;
  symbol: string;
  onChangeBudgets: (budgets: Budgets) => void;
  onChangeBudgetMode: (mode: 'category' | 'total') => void;
  onChangeTotalBudget: (amount: number) => void;
  /** The Done button — returns to the Settings sheet, not plain close. */
  onDone: () => void;
  /** Scrollable wrapper for the rows below the header; see file header. */
  ScrollContainer?: ComponentType<ScrollContainerProps>;
}

export function BudgetsSheet({
  expCats,
  budgets,
  budgetMode,
  totalBudget,
  symbol,
  onChangeBudgets,
  onChangeBudgetMode,
  onChangeTotalBudget,
  onDone,
  ScrollContainer = ScrollView as ComponentType<ScrollContainerProps>,
}: BudgetsSheetProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton name="chevron-left" accessibilityLabel={strings.nav.back} onPress={onDone} />
        <Txt variant="screenTitle">{strings.budgets.title}</Txt>
      </View>
      <ScrollContainer
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.toggleCard, { backgroundColor: colors.card2 }]}>
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleOption,
                budgetMode === 'category' && { backgroundColor: colors.card3 },
              ]}
              onPress={() => onChangeBudgetMode('category')}
              accessible
              accessibilityRole="radio"
              accessibilityState={{ selected: budgetMode === 'category' }}
            >
              <Txt
                variant="listItem"
                tone={budgetMode === 'category' ? 'ink' : 'muted'}
              >
                {strings.budgets.perCategory}
              </Txt>
            </Pressable>
            <Pressable
              style={[
                styles.toggleOption,
                budgetMode === 'total' && { backgroundColor: colors.card3 },
              ]}
              onPress={() => onChangeBudgetMode('total')}
              accessible
              accessibilityRole="radio"
              accessibilityState={{ selected: budgetMode === 'total' }}
            >
              <Txt variant="listItem" tone={budgetMode === 'total' ? 'ink' : 'muted'}>
                {strings.budgets.total}
              </Txt>
            </Pressable>
          </View>
        </View>

        {budgetMode === 'category' ? (
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
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card2 }]}>
            <TotalBudgetRow
              amount={totalBudget}
              symbol={symbol}
              onChange={(amount) => onChangeTotalBudget(amount === null ? 0 : amount)}
            />
          </View>
        )}
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

/**
 * Total budget row in total mode — a single amount field for the whole month.
 * Uses the same digits-only, blank-clears convention as per-category rows.
 */
function TotalBudgetRow({
  amount,
  symbol,
  onChange,
}: {
  amount: number;
  symbol: string;
  onChange: (amount: number | null) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(amount > 0 ? String(amount) : '');

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, AMOUNT_MAX_DIGITS);
    setDraft(digits);
    onChange(digits === '' ? null : parseInt(digits, 10));
  };

  return (
    <View style={styles.row}>
      <Txt variant="listItem" tone="ink" style={styles.totalLabel}>
        {strings.budgets.totalAmount}
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
        accessibilityLabel={strings.budgets.totalBudgetLabel}
        style={[styles.input, { backgroundColor: colors.card3, color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink + minHeight:0 let this body cap to the sheet host's maxHeight
  // (#63) so the scroll region below the header bounds and scrolls, instead of
  // the whole sheet growing to full content height and running off-screen.
  container: { gap: 4, flexShrink: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scroll: { flex: 1, minHeight: 0 },
  scrollBody: { paddingBottom: 4, gap: 12 },
  toggleCard: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
  },
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
  totalLabel: { flex: 1 },
  input: {
    width: 104,
    height: 38,
    borderRadius: metrics.iconTileRadius,
    paddingHorizontal: 10,
    fontSize: 14.5,
    textAlign: 'right',
  },
});
