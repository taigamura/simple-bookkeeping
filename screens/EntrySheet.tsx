/**
 * EntrySheet — the populated New Entry sheet content (slice #3). Captures a
 * draft (type · amount · category) and builds a `Transaction` on save. Recurrence
 * (Note/Repeat/weekend rows) and the slim ad are later slices; this is the thin
 * money path: toggle type, key an amount, pick a category, save.
 *
 * Presentational state only — the parent owns persistence and where the new
 * entry lands (it passes the target `y`/`m`/`day`).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  amountValue,
  makeEntry,
  pressKey,
  yen,
  type KeypadKey,
  type Transaction,
  type TxType,
} from '../domain';
import { CategoryChips, Keypad, SegmentedToggle } from '../ui';
import { useTheme, metrics, accents, shadows, heroAmountSize, Txt } from '../theme';
import { IconButton } from '../nav/IconButton';

interface EntrySheetProps {
  expCats: string[];
  incCats: string[];
  /** Where the entry lands: current calendar cursor + selected day. */
  y: number;
  m: number;
  day: number;
  symbol: string;
  onSave: (entry: Transaction) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'expense' as TxType, label: 'Expense' },
  { value: 'income' as TxType, label: 'Income' },
];

export function EntrySheet({
  expCats,
  incCats,
  y,
  m,
  day,
  symbol,
  onSave,
  onClose,
}: EntrySheetProps) {
  const { colors } = useTheme();
  const [txType, setTxType] = useState<TxType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const catsFor = (t: TxType) => (t === 'income' ? incCats : expCats);
  const [category, setCategory] = useState(() => catsFor('expense')[0]);

  const value = amountValue(amountStr);
  const canSave = value > 0;
  const heroText = yen(value, symbol);

  const changeType = (next: TxType) => {
    setTxType(next);
    // Keep the selected category valid for the new type's list.
    if (!catsFor(next).includes(category)) setCategory(catsFor(next)[0]);
  };

  const save = () => {
    const entry = makeEntry({ type: txType, amountStr, category, y, m, day });
    if (entry) onSave(entry);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.toggleWrap}>
          <SegmentedToggle
            options={TYPE_OPTIONS}
            value={txType}
            onChange={changeType}
            activeColor={colors.card3}
            activeTone="ink"
          />
        </View>
        <IconButton name="x" accessibilityLabel="Close" onPress={onClose} />
      </View>

      <View style={styles.amountBlock}>
        <Txt
          variant="heroAmount"
          tone={txType === 'income' ? 'positive' : 'ink'}
          style={{ fontSize: heroAmountSize(heroText) }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {heroText}
        </Txt>
        <Txt variant="microLabel" tone="dim">
          {txType}
        </Txt>
      </View>

      <CategoryChips
        categories={catsFor(txType)}
        selected={category}
        onSelect={setCategory}
      />

      <View style={styles.keypad}>
        <Keypad onKey={(key: KeypadKey) => setAmountStr((s) => pressKey(s, key))} />
      </View>

      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        style={[
          styles.cta,
          { backgroundColor: accents.positive, opacity: canSave ? 1 : 0.4 },
          canSave && shadows.ctaGlow,
        ]}
      >
        <Txt variant="listItem" tone="onPositive">
          Add {txType === 'income' ? 'Income' : 'Expense'}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleWrap: { flex: 1 },
  amountBlock: { alignItems: 'center', gap: 6, paddingVertical: 4 },
  keypad: { marginTop: 2 },
  cta: {
    height: metrics.ctaHeight,
    borderRadius: metrics.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
