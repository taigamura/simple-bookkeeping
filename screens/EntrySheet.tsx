/**
 * EntrySheet — the New Entry sheet (slices #3 + #6). Captures a draft
 * (type · amount · category · note · repeat · weekend-shift) and materializes it
 * into one or more `Transaction`s on save (decision 2: materialize-on-save, no
 * scheduler). Recurrence rows cycle their options on tap; the weekend row shows
 * only for monthly/yearly repeats.
 *
 * Presentational state only — the parent owns persistence and where the entries
 * land (it passes the target `y`/`m`/`day`).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  amountValue,
  materialize,
  pressKey,
  yen,
  type KeypadKey,
  type Repeat,
  type Transaction,
  type TxType,
  type WeekendShift,
} from '../domain';
import { AdCard, CategoryChips, Keypad, SegmentedToggle } from '../ui';
import { useTheme, metrics, accents, shadows, heroAmountSize, Txt, type Tone } from '../theme';
import { IconButton } from '../nav/IconButton';

interface EntrySheetProps {
  expCats: string[];
  incCats: string[];
  /** Where the entry lands: current calendar cursor + selected day. */
  y: number;
  m: number;
  day: number;
  symbol: string;
  /** Slim free-tier ad above the keypad; hidden for premium (decision 7). */
  showAd: boolean;
  onSave: (entries: Transaction[]) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'expense' as TxType, label: 'Expense' },
  { value: 'income' as TxType, label: 'Income' },
];

/**
 * Note presets cycled by the Note row; '—' means "fall back to the category".
 * Presets are per-type (design §7): the first entry is always the default '—'.
 */
const NOTE_OPTIONS: Record<TxType, string[]> = {
  expense: ['—', 'Cash', 'Card', 'Konbini', 'Online'],
  income: ['—', 'Bank transfer', 'Cash', 'Bonus'],
};

const REPEAT_ORDER: Repeat[] = ['never', 'daily', 'monthly', 'yearly'];
const REPEAT_LABEL: Record<Repeat, string> = {
  never: 'Never',
  daily: 'Every day',
  monthly: 'Every month',
  yearly: 'Every year',
};

// Cycle order starts at 'after' (Move to Monday) — the design default (§7).
const SHIFT_ORDER: WeekendShift[] = ['after', 'before', 'off'];
const SHIFT_LABEL: Record<WeekendShift, string> = {
  after: 'Move to Monday',
  before: 'Move to Friday',
  off: 'Keep on weekend',
};

const next = <T,>(order: T[], value: T): T =>
  order[(order.indexOf(value) + 1) % order.length];

export function EntrySheet({
  expCats,
  incCats,
  y,
  m,
  day,
  symbol,
  showAd,
  onSave,
  onClose,
}: EntrySheetProps) {
  const { colors } = useTheme();
  const [txType, setTxType] = useState<TxType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const catsFor = (t: TxType) => (t === 'income' ? incCats : expCats);
  const [category, setCategory] = useState(() => catsFor('expense')[0]);
  const [note, setNote] = useState('—');
  const [repeat, setRepeat] = useState<Repeat>('never');
  const [weekendShift, setWeekendShift] = useState<WeekendShift>('after');

  const value = amountValue(amountStr);
  const canSave = value > 0;
  const heroText = yen(value, symbol);
  const showWeekend = repeat === 'monthly' || repeat === 'yearly';

  const changeType = (nextType: TxType) => {
    setTxType(nextType);
    // Keep the selected category valid for the new type's list.
    if (!catsFor(nextType).includes(category)) setCategory(catsFor(nextType)[0]);
    // Note presets are per-type; drop a preset that isn't in the new list.
    if (!NOTE_OPTIONS[nextType].includes(note)) setNote('—');
  };

  const save = () => {
    const entries = materialize(
      { type: txType, amountStr, category, note, y, m, day, repeat },
      weekendShift,
    );
    if (entries.length) onSave(entries);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.toggleWrap}>
          {/* Active segment defaults to green + near-black (design §6). */}
          <SegmentedToggle options={TYPE_OPTIONS} value={txType} onChange={changeType} />
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

      <View style={[styles.rowsCard, { backgroundColor: colors.card2 }]}>
        <CycleRow
          first
          label="Note"
          value={note}
          active={note !== '—'}
          onPress={() => setNote((n) => next(NOTE_OPTIONS[txType], n))}
        />
        <CycleRow
          label="↻ Repeat"
          value={REPEAT_LABEL[repeat]}
          active={repeat !== 'never'}
          activeTone="positive"
          onPress={() => setRepeat((r) => next(REPEAT_ORDER, r))}
        />
        {showWeekend && (
          <CycleRow
            label="If on weekend"
            value={SHIFT_LABEL[weekendShift]}
            active={weekendShift !== 'after'}
            onPress={() => setWeekendShift((s) => next(SHIFT_ORDER, s))}
          />
        )}
      </View>

      {showAd && <AdCard variant="slim" />}

      <Keypad onKey={(key: KeypadKey) => setAmountStr((s) => pressKey(s, key))} />

      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={`Add ${txType === 'income' ? 'income' : 'expense'}`}
        accessibilityState={{ disabled: !canSave }}
        style={[
          styles.cta,
          // Disabled = card2 fill + dim text; enabled = green + glow (design §8).
          { backgroundColor: canSave ? accents.positive : colors.card2 },
          canSave && shadows.ctaGlow,
        ]}
      >
        <Txt variant="listItem" tone={canSave ? 'onPositive' : 'dim'}>
          Add {txType === 'income' ? 'income' : 'expense'}
        </Txt>
      </Pressable>
    </View>
  );
}

/**
 * A tappable option row inside the grouped card: sans-13 dim label on the left,
 * current value on the right. The value is dim at its default (`active` false)
 * and tinted otherwise — `activeTone` (default ink) lets Repeat go green when
 * set. A hairline top divider separates rows; the `first` row omits it.
 */
function CycleRow({
  label,
  value,
  active,
  activeTone = 'ink',
  first = false,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  activeTone?: Tone;
  first?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Txt variant="optionLabel" tone="dim">
        {label}
      </Txt>
      <Txt variant="listItem" tone={active ? activeTone : 'dim'}>
        {value}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleWrap: { flex: 1 },
  amountBlock: { alignItems: 'center', gap: 6, paddingVertical: 2 },
  rowsCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 46,
  },
  cta: {
    height: metrics.ctaHeight,
    borderRadius: metrics.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
