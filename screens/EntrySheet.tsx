/**
 * EntrySheet — the New/Edit Entry sheet (slices #3 + #6 + #43). Captures a draft
 * (type · amount · category · note · repeat · weekend-shift) and hands it to the
 * host on save; the host stores either one concrete transaction or an infinite
 * recurrence rule. Recurrence rows cycle their options on tap; the weekend row
 * shows only for monthly/yearly repeats.
 *
 * With `editing` set the sheet prefills every editable field, including date,
 * and exposes a Delete action. Recurring edits clearly apply to this and future
 * occurrences.
 *
 * Presentational state only — the parent owns persistence and where the entries
 * land (it passes the target `y`/`m`/`day`).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  amountValue,
  pressKey,
  yen,
  type EntryDraft,
  type KeypadKey,
  type Repeat,
  type RecurrenceDate,
  type Transaction,
  type TxType,
  type WeekendShift,
} from '../domain';
import { strings } from '../i18n';
import { CategoryChips, Keypad, SegmentedToggle } from '../ui';
import {
  useTheme,
  metrics,
  accents,
  shadows,
  heroAmountSize,
  mono,
  Txt,
  type Tone,
} from '../theme';
import { IconButton } from '../nav/IconButton';

interface EntrySheetProps {
  expCats: string[];
  incCats: string[];
  /** Where the entry lands: current calendar cursor + selected day. */
  y: number;
  m: number;
  day: number;
  /** Current local date, used by the form's quick "today" action. */
  today: RecurrenceDate;
  symbol: string;
  /**
   * Existing concrete or projected occurrence to edit (#43).
   */
  editing?: Transaction;
  /** Settings management route: recurring cadences only and explicit stop copy. */
  repeatManagement?: boolean;
  /** Collects the draft on save; the host stores or splits the corresponding ledger item. */
  onSave: (draft: EntryDraft, weekendShift: WeekendShift) => void;
  /** Edit mode only: request deletion of `editing` (the host chooses scope). */
  onDelete?: (entry: Transaction) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'expense' as TxType, label: strings.common.expense },
  { value: 'income' as TxType, label: strings.common.income },
];

/**
 * Note presets cycled by the Note row; '—' means "fall back to the category".
 * Presets are per-type (design §7): the first entry is always the default '—'.
 */
const NOTE_OPTIONS: Record<TxType, string[]> = strings.entry.notePresets;

const REPEAT_ORDER: Repeat[] = ['never', 'daily', 'monthly', 'yearly'];
const REPEAT_LABEL: Record<Repeat, string> = strings.entry.repeatLabels;

// Cycle order starts at 'after' (Move to Monday) — the design default (§7).
const SHIFT_ORDER: WeekendShift[] = ['after', 'before', 'off'];
const SHIFT_LABEL: Record<WeekendShift, string> = strings.entry.weekendLabels;

const next = <T,>(order: T[], value: T): T =>
  order[(order.indexOf(value) + 1) % order.length];

const formatDate = ({ y, m, day }: RecurrenceDate): string =>
  `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const parseDate = (value: string): RecurrenceDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (y === 0 || m < 0 || m > 11 || day < 1) return null;
  const candidate = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getUTCFullYear() !== y ||
    candidate.getUTCMonth() !== m ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return { y, m, day };
};

export function EntrySheet({
  expCats,
  incCats,
  y,
  m,
  day,
  today,
  symbol,
  editing,
  repeatManagement = false,
  onSave,
  onDelete,
  onClose,
}: EntrySheetProps) {
  const { colors } = useTheme();
  const isEditing = editing != null;
  const catsFor = (t: TxType) => (t === 'income' ? incCats : expCats);
  const [txType, setTxType] = useState<TxType>(editing?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState(
    () => editing?.category ?? catsFor(editing?.type ?? 'expense')[0],
  );
  const [note, setNote] = useState(editing?.note ?? '—');
  const [repeat, setRepeat] = useState<Repeat>(editing?.repeat ?? 'never');
  const [weekendShift, setWeekendShift] = useState<WeekendShift>(
    editing?.occurrence?.weekendShift ?? 'after',
  );
  const [dateText, setDateText] = useState(() =>
    formatDate(editing?.occurrence?.scheduled ?? editing ?? { y, m, day }),
  );

  const value = amountValue(amountStr);
  const enteredDate = parseDate(dateText);
  const categoryIsCurrent = catsFor(txType).includes(category);
  const canSave =
    value > 0 &&
    enteredDate !== null &&
    (!repeatManagement || categoryIsCurrent);
  const heroText = yen(value, symbol);
  const showWeekend = repeat === 'monthly' || repeat === 'yearly';
  const editsSeries =
    isEditing && ((editing.repeat ?? 'never') !== 'never' || repeat !== 'never');
  const ctaLabel = isEditing
    ? editsSeries
      ? strings.entry.saveThisAndFuture
      : strings.entry.save
    : txType === 'income'
      ? strings.entry.addIncome
      : strings.entry.addExpense;

  const changeType = (nextType: TxType) => {
    setTxType(nextType);
    // Keep the selected category valid for the new type's list.
    if (!catsFor(nextType).includes(category)) setCategory(catsFor(nextType)[0]);
    // Note presets are per-type; drop a preset that isn't in the new list.
    if (!NOTE_OPTIONS[nextType].includes(note)) setNote('—');
  };

  const save = () => {
    if (!enteredDate) return;
    onSave(
      { type: txType, amountStr, category, note, ...enteredDate, repeat },
      weekendShift,
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.toggleWrap}>
          {/* Active segment defaults to green + near-black (design §6). */}
          <SegmentedToggle options={TYPE_OPTIONS} value={txType} onChange={changeType} />
        </View>
        <IconButton name="x" accessibilityLabel={strings.nav.close} onPress={onClose} />
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
          {txType === 'income' ? strings.common.income : strings.common.expense}
        </Txt>
      </View>

      <CategoryChips
        categories={catsFor(txType)}
        selected={category}
        onSelect={setCategory}
      />
      {repeatManagement && !categoryIsCurrent && (
        <Txt variant="secondary" tone="negative" style={styles.categoryWarning}>
          {strings.repeats.chooseCurrentCategory}
        </Txt>
      )}

      <View style={[styles.rowsCard, { backgroundColor: colors.card2 }]}>
        <View style={styles.dateSection}>
          <View style={styles.dateRow}>
            <Txt variant="optionLabel" tone="dim">
              {strings.entry.dateRowLabel}
            </Txt>
            <View style={styles.dateControls}>
              <TextInput
                value={dateText}
                onChangeText={setDateText}
                placeholder={strings.entry.datePlaceholder}
                placeholderTextColor={colors.dim}
                accessibilityLabel={`${strings.entry.dateRowLabel} ${strings.entry.datePlaceholder}`}
                accessibilityValue={{ text: dateText }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
                returnKeyType="done"
                style={[styles.dateInput, { color: colors.ink }]}
              />
              <Pressable
                onPress={() => setDateText(formatDate(today))}
                accessibilityRole="button"
                accessibilityLabel={strings.entry.useToday}
                style={({ pressed }) => [styles.todayButton, pressed && { opacity: 0.6 }]}
              >
                <Txt variant="optionLabel" tone="positive">
                  {strings.entry.today}
                </Txt>
              </Pressable>
            </View>
          </View>
          {!enteredDate && (
            <Txt variant="secondary" tone="negative" style={styles.dateWarning}>
              {strings.entry.invalidDate}
            </Txt>
          )}
        </View>
        <CycleRow
          label={strings.entry.noteRowLabel}
          value={note}
          active={note !== '—'}
          onPress={() => setNote((n) => next(NOTE_OPTIONS[txType], n))}
        />
        <CycleRow
          label={strings.entry.repeatRowLabel}
          value={REPEAT_LABEL[repeat]}
          active={repeat !== 'never'}
          activeTone="positive"
          accessibilityHint={strings.a11y.recurrenceHint}
          onPress={() =>
            setRepeat((r) =>
              next(repeatManagement ? REPEAT_ORDER.slice(1) : REPEAT_ORDER, r),
            )
          }
        />
        {showWeekend && (
          <CycleRow
            label={strings.entry.weekendRowLabel}
            value={SHIFT_LABEL[weekendShift]}
            active={weekendShift !== 'after'}
            onPress={() => setWeekendShift((s) => next(SHIFT_ORDER, s))}
          />
        )}
      </View>

      <Keypad onKey={(key: KeypadKey) => setAmountStr((s) => pressKey(s, key))} />

      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        accessibilityState={{ disabled: !canSave }}
        style={[
          styles.cta,
          // Disabled = card2 fill + dim text; enabled = green + glow (design §8).
          { backgroundColor: canSave ? accents.positive : colors.card2 },
          canSave && shadows.ctaGlow,
        ]}
      >
        <Txt variant="listItem" tone={canSave ? 'onPositive' : 'dim'}>
          {ctaLabel}
        </Txt>
      </Pressable>

      {isEditing && onDelete && (
        <Pressable
          onPress={() => onDelete(editing)}
          accessibilityRole="button"
          accessibilityLabel={repeatManagement ? strings.repeats.stopRepeat : strings.entry.deleteEntry}
          style={({ pressed }) => [styles.deleteRow, pressed && { opacity: 0.6 }]}
        >
          <Txt variant="listItem" tone="negative">
            {repeatManagement ? strings.repeats.stopRepeat : strings.entry.deleteEntry}
          </Txt>
        </Pressable>
      )}
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
  accessibilityHint,
}: {
  label: string;
  value: string;
  active: boolean;
  activeTone?: Tone;
  first?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={accessibilityHint}
      accessibilityValue={{ text: value }}
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
  dateSection: {
    minHeight: 46,
  },
  dateRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dateControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    width: 94,
    minHeight: 44,
    paddingHorizontal: 0,
    fontFamily: mono.semibold,
    fontSize: 14.5,
    textAlign: 'right',
  },
  todayButton: {
    minHeight: 44,
    paddingLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateWarning: {
    paddingBottom: 10,
    textAlign: 'right',
  },
  cta: {
    height: metrics.ctaHeight,
    borderRadius: metrics.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  categoryWarning: { textAlign: 'center' },
});
