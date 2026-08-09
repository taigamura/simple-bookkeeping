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
import React, { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
import { CategoryChips, Keypad, PressScale, SaveWave, SegmentedToggle } from '../ui';
import {
  useMotion,
  useTheme,
  metrics,
  glowFor,
  heroAmountSize,
  mono,
  Txt,
  type Tone,
} from '../theme';
import { IconButton } from '../nav/IconButton';
import { SHEET_CHROME, WEB_FRAME_INSET } from '../nav/BottomSheet';
import { DatePickerBoundary, formatPickerDate } from '../platform/DatePickerBoundary';

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
  /** Reports intrinsic form height so the host can grow with conditional rows. */
  onContentHeightChange?: (height: number) => void;
  /**
   * Scrollable wrapper for the form body (#44 pattern, as Settings/Budgets
   * already do). Defaults to RN's plain `ScrollView` so this file's standalone
   * tests render outside a bottom sheet; the real app swaps in gorhom's
   * `BottomSheetScrollView` so an in-sheet drag scrolls the body rather than
   * fighting the sheet's own pan gesture.
   */
  ScrollContainer?: ComponentType<ScrollContainerProps>;
}

/** Minimal shape shared by RN's `ScrollView` and gorhom's `BottomSheetScrollView`. */
interface ScrollContainerProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  children: ReactNode;
}

const TYPE_OPTIONS = [
  { value: 'expense' as TxType, label: strings.common.expense },
  { value: 'income' as TxType, label: strings.common.income },
];

const REPEAT_ORDER: Repeat[] = ['never', 'daily', 'monthly', 'yearly'];
const REPEAT_LABEL: Record<Repeat, string> = strings.entry.repeatLabels;

// Cycle order starts at 'after' (Move to Monday) — the design default (§7).
const SHIFT_ORDER: WeekendShift[] = ['after', 'before', 'off'];
const SHIFT_LABEL: Record<WeekendShift, string> = strings.entry.weekendLabels;

const next = <T,>(order: T[], value: T): T =>
  order[(order.indexOf(value) + 1) % order.length];

/**
 * How long the save bloom plays before the sheet is told to close (ms).
 *
 * Originally 170ms, on the theory that added latency past ~200ms starts
 * reading as lag. In practice that made the wave imperceptible: `SaveWave`'s
 * spread reaches full size at 70% of `durations.wave` (≈434ms), so at 170ms it
 * had barely started — the sheet's own 200ms dismiss (see
 * `SHEET_ANIMATION_DURATION`) then began sliding over a bloom that was ~13%
 * grown, and by the time the sheet cleared the screen there was nothing left
 * to see. Measured directly (sampling computed styles at every animation
 * frame, not just screenshots) rather than assumed.
 *
 * The "~200ms lag" rule is the right instinct for latency with *nothing* to
 * show for it — a frozen screen. It doesn't apply here: for the whole lead the
 * user is watching the bloom actively expand from the button they just
 * pressed, which is itself the feedback that the tap registered. So the lead
 * is now tuned to the animation instead of to the lag threshold: long enough
 * for the spread to finish and the fade to be clearly underway before the
 * sheet starts covering it, so a real "grow then fade" reads as one complete
 * gesture rather than a truncated blip.
 */
const WAVE_LEAD = 380;

/**
 * Vertical space the Delete action occupies below the CTA in edit mode: its own
 * 44px min height plus its 8px bottom margin. The pinned footer stacks its two
 * children directly with no gap between them, so there is nothing else to add.
 * Kept in step with `styles.deleteRow` below.
 */
const DELETE_ROW_BLOCK = 44 + 8;

/**
 * Intrinsic height of the form at full size, measured on a tall screen. Used
 * only as the denominator of the compact factor below — the real height is
 * still measured at layout and reported to the host for its detent.
 */
const NATURAL_FORM_HEIGHT = 760;

/**
 * Floor for the compact factor. Past this the form has given up as much as it
 * can without the controls becoming hard to hit (see `MIN_KEY_HEIGHT` in
 * `Keypad`), and the remainder is taken as scroll instead.
 */
const MIN_COMPACT_SCALE = 0.72;

/** The footer is outside the scaled body and must get its own room budget. */
const FOOTER_BUDGET = metrics.ctaHeight + 14;

/** Rough home-indicator / bottom safe area on native; see `useCompactScale`. */
const NATIVE_BOTTOM_ALLOWANCE = 34;

/**
 * Resolve the body's compact factor from the available window height.
 *
 * `SHEET_CHROME` already includes the top backdrop strip, handle, and sheet
 * padding. Keeping that accounting in one place is important: subtracting the
 * strip again makes ordinary phones compact earlier than necessary and turns
 * the scroll fallback into the default instead of the last resort.
 */
export function entryCompactScale(windowHeight: number, chrome: number): number {
  const budget = windowHeight - chrome - SHEET_CHROME - FOOTER_BUDGET;
  return Math.max(MIN_COMPACT_SCALE, Math.min(1, budget / NATURAL_FORM_HEIGHT));
}

/**
 * How much the form shrinks to fit the screen it was opened on.
 *
 * The Entry sheet is a fixed-form layout with no scroll by design — you should
 * be able to see the amount, the categories and the keypad at once, because
 * entering an expense is a single glance-and-tap. That intent held until the
 * form met a short screen: at ~760px of intrinsic height it simply overran the
 * sheet's content box, and since the CTA sits at the bottom, the button you
 * came to press was the first thing clipped off. Nothing ever shrank, because
 * the host's dynamic sizing only ever grew the sheet *up to* its cap.
 *
 * So the form now scales toward its screen. The factor is derived from the
 * window rather than from a measured available height on purpose: measuring
 * would close a loop (scale → intrinsic height → sheet detent → available
 * height → scale) that can oscillate for a whole second before settling. The
 * window is an independent input, so the factor resolves in one pass.
 *
 * Scaling alone cannot cover the worst cases — the floor above stops it well
 * short — which is why it is paired with a pinned CTA and a scrolling body.
 * Scaling is what keeps an ordinary phone from scrolling a form that was
 * designed not to; the pinning is what guarantees the button is *reachable*.
 */
function useCompactScale(): number {
  const { height: windowHeight } = useWindowDimensions();
  // Everything between the window edges and the sheet's content box. On web
  // that is the phone frame's padding + border (imported from BottomSheet so
  // the two cannot drift); on native it is the status bar and home indicator,
  // approximated by `metrics.statusOffset` — which exists for exactly this
  // purpose — plus a home-indicator allowance.
  //
  // Deliberately approximated rather than read from `useSafeAreaInsets()`: that
  // hook throws outside a `SafeAreaProvider`, which would make this component
  // unrenderable in isolation, and being a few pixels out only nudges a soft
  // heuristic. The pinned CTA — not this number — is what guarantees the button
  // is reachable, so precision here buys nothing.
  const chrome =
    Platform.OS === 'web' ? WEB_FRAME_INSET : metrics.statusOffset + NATIVE_BOTTOM_ALLOWANCE;
  // Entry opens at the host's expanded detent. Reserve the pinned footer
  // before scaling the scrollable body; otherwise the form can still be just
  // tall enough to push 0/00 below the fold even though the sheet is fullscreen.
  return entryCompactScale(windowHeight, chrome);
}

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
  onContentHeightChange,
  ScrollContainer = ScrollView as ComponentType<ScrollContainerProps>,
}: EntrySheetProps) {
  const { colors } = useTheme();
  const scale = useCompactScale();
  // Body and footer are measured separately and summed: the body is the part
  // that may scroll, the footer is pinned, and the host needs their total to
  // pick a detent tall enough to show both.
  const bodyHeight = useRef(0);
  const footerHeight = useRef(0);
  const reportHeight = () => {
    if (bodyHeight.current > 0 && footerHeight.current > 0) {
      onContentHeightChange?.(Math.ceil(bodyHeight.current + footerHeight.current));
    }
  };
  // Scaled spacing. Row heights keep a 40px floor for the same reason the
  // keypad keys do — below that a tap row stops being a comfortable target.
  const gap = Math.max(8, Math.round(14 * scale));
  const rowHeight = Math.max(40, Math.round(46 * scale));
  const { enabled: motionEnabled } = useMotion();
  // Bloom fire counter, and the latch that keeps the CTA from re-firing during
  // the lead. Both are local: the host knows nothing about the animation.
  const [wave, setWave] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditing = editing != null;
  const catsFor = (t: TxType) => (t === 'income' ? incCats : expCats);
  const [txType, setTxType] = useState<TxType>(editing?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState(
    () => editing?.category ?? catsFor(editing?.type ?? 'expense')[0],
  );
  const [note, setNote] = useState(editing?.note ?? '');
  const [repeat, setRepeat] = useState<Repeat>(editing?.repeat ?? 'never');
  const [weekendShift, setWeekendShift] = useState<WeekendShift>(
    editing?.occurrence?.weekendShift ?? 'after',
  );
  const [entryDate, setEntryDate] = useState<RecurrenceDate>(
    editing?.occurrence?.scheduled ?? editing ?? { y, m, day },
  );
  const [dateText, setDateText] = useState(() => formatPickerDate(entryDate));

  const value = amountValue(amountStr);
  const enteredDate = parseDate(dateText);
  // Where the bloom starts: the middle of the CTA, measured up from the bottom
  // of the form. In edit mode the CTA is not the last row — the Delete action
  // and the container's row gap sit below it — so the origin has to clear both,
  // or the wave would appear to launch from the destructive button.
  // Where the bloom starts: the middle of the CTA, measured up from the bottom
  // of the sheet. The CTA now sits in the pinned footer, so this is a fixed
  // offset rather than something that moves with the body's height — but in
  // edit mode the Delete action still sits below it and has to be cleared, or
  // the wave would appear to launch from the destructive button.
  const showDelete = isEditing && onDelete != null;
  const waveOrigin = (showDelete ? DELETE_ROW_BLOCK : 0) + metrics.ctaHeight / 2;
  const categoryIsCurrent = catsFor(txType).includes(category);
  const canSave =
    value > 0 &&
    enteredDate !== null &&
    (!repeatManagement || categoryIsCurrent);
  const heroText = yen(value, symbol);
  const showWeekend = repeat === 'monthly' || repeat === 'yearly';
  const editsSeries =
    isEditing && ((editing.repeat ?? 'never') !== 'never' || repeat !== 'never');
  // Editing a projected occurrence (as opposed to a plain entry or a legacy
  // materialized repeat with no rule) is where the host asks "just this one,
  // or this and future?" after Save is pressed — see nav/Root's `handleSubmit`
  // and `chooseRecurringSave`. The label stays a plain "Save" here rather than
  // pre-announcing "this and future", since the actual scope is decided in
  // that follow-up, not by this button. Not in `repeatManagement`: Settings →
  // Repeats never asks (there is no "just this once" reading of editing the
  // series itself), so its label keeps truthfully saying what it always does.
  const isOccurrenceEdit = isEditing && editing.occurrence != null && !repeatManagement;
  const ctaLabel = isEditing
    ? isOccurrenceEdit
      ? strings.entry.save
      : editsSeries
        ? strings.entry.saveThisAndFuture
        : strings.entry.save
    : txType === 'income'
      ? strings.entry.addIncome
      : strings.entry.addExpense;

  const changeType = (nextType: TxType) => {
    setTxType(nextType);
    // Keep the selected category valid for the new type's list.
    if (!catsFor(nextType).includes(category)) setCategory(catsFor(nextType)[0]);
  };

  // Save is deliberately not instantaneous when motion is on (#motion): the
  // bloom is fired first and `onSave` — which dismisses this sheet — follows a
  // beat later, so the wave plays inside the sheet it came from rather than
  // being cut off the moment the sheet unmounts. The host's dismissal then runs
  // *through* the tail of the bloom, which is what makes the two read as one
  // gesture rather than two events.
  //
  // WAVE_LEAD is the whole added latency of a save. It is short enough to stay
  // under the ~200ms threshold where a delay starts reading as lag, and the
  // wave itself covers the wait, so nothing appears frozen.
  const save = () => {
    if (!enteredDate || saving) return;
    const draft = { type: txType, amountStr, category, note, ...enteredDate, repeat };

    if (!motionEnabled) {
      onSave(draft, weekendShift);
      return;
    }

    // Latch immediately so a double-tap during the lead cannot save twice —
    // the CTA is still on screen and still under the finger for that window.
    setSaving(true);
    setWave((n) => n + 1);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      onSave(draft, weekendShift);
    }, WAVE_LEAD);
  };

  // The sheet host unmounts this content on dismiss, which can land before the
  // lead elapses if the user pans the sheet down mid-save. Dropping the timer
  // on unmount keeps that from firing `onSave` into a torn-down tree.
  useEffect(
    () => () => {
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    },
    [],
  );

  return (
    <View style={styles.host}>
      <ScrollContainer
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        // The amount is entered on the in-form keypad, but Note/Date are real
        // text inputs; without this a tap on a keypad key while the keyboard is
        // up would be eaten by the dismiss instead of registering a digit.
        keyboardShouldPersistTaps="handled"
      >
        <View
          testID="entry-content"
          style={[styles.container, { gap }]}
          onLayout={(event) => {
            bodyHeight.current = event.nativeEvent.layout.height;
            reportHeight();
          }}
        >
          <View style={styles.topRow}>
        <View style={styles.toggleWrap}>
          {/* Active segment defaults to the theme accent + on-accent text. */}
          <SegmentedToggle options={TYPE_OPTIONS} value={txType} onChange={changeType} />
        </View>
        <IconButton name="x" accessibilityLabel={strings.nav.close} onPress={onClose} />
      </View>

      <View style={styles.amountBlock}>
        <Txt
          variant="heroAmount"
          tone={txType === 'income' ? 'positive' : 'ink'}
            style={{ fontSize: Math.round(heroAmountSize(heroText) * scale) }}
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
              <DatePickerBoundary
                value={enteredDate ?? entryDate}
                today={today}
                label={`${strings.entry.dateRowLabel} ${strings.entry.datePlaceholder}`}
                onChange={(nextDate) => {
                  setEntryDate(nextDate);
                  setDateText(formatPickerDate(nextDate));
                }}
                onTextChange={setDateText}
              />
              <Pressable
                onPress={() => {
                  setEntryDate(today);
                  setDateText(formatPickerDate(today));
                }}
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
        <View
          style={[
            styles.noteRow,
            {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.hair,
            },
          ]}
        >
          <Txt variant="optionLabel" tone="dim">
            {strings.entry.noteRowLabel}
          </Txt>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={strings.entry.notePlaceholder}
            placeholderTextColor={colors.dim}
            accessibilityLabel={strings.entry.noteRowLabel}
            accessibilityValue={{ text: note || strings.entry.notePlaceholder }}
            returnKeyType="done"
            style={[styles.noteInput, { color: colors.ink }]}
          />
        </View>
        <CycleRow
          height={rowHeight}
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
            height={rowHeight}
            label={strings.entry.weekendRowLabel}
            value={SHIFT_LABEL[weekendShift]}
            active={weekendShift !== 'after'}
            onPress={() => setWeekendShift((s) => next(SHIFT_ORDER, s))}
          />
        )}
      </View>

          <Keypad
            scale={scale}
            onKey={(key: KeypadKey) => setAmountStr((s) => pressKey(s, key))}
          />
        </View>
      </ScrollContainer>

      {/* Pinned footer. The CTA is the one control that must never be off
          screen — it is the whole point of opening this sheet — so it lives
          outside the scrollable body and is laid out last against the bottom
          of the sheet, whatever the body above it does. */}
      <View
        testID="entry-footer"
        style={[styles.footer, { paddingTop: gap }]}
        onLayout={(event) => {
          footerHeight.current = event.nativeEvent.layout.height;
          reportHeight();
        }}
      >
        <PressScale
          scale="surface"
          onPress={save}
          disabled={!canSave || saving}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          // Reports only the *form's* validity, not the mid-save latch: a screen
          // reader announcing "dimmed" for 170ms after a successful save would be
          // describing an animation, which is not information.
          accessibilityState={{ disabled: !canSave }}
          style={[
            styles.cta,
            // Disabled = card2 fill + dim text; enabled = accent + glow.
            { backgroundColor: canSave ? colors.positive : colors.card2 },
            canSave && glowFor(colors.positive),
          ]}
        >
          <Txt variant="listItem" tone={canSave ? 'onPositive' : 'dim'}>
            {ctaLabel}
          </Txt>
        </PressScale>

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

      {/* Last child so the bloom paints over the whole form, body and footer
          alike. It is out of flow (absolutely positioned), so it neither shifts
          the layout nor inflates the height reported for the sheet's detent. */}
      <SaveWave nonce={wave} color={colors.positive} originFromBottom={waveOrigin} />
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
  height,
  onPress,
  accessibilityHint,
}: {
  label: string;
  value: string;
  active: boolean;
  activeTone?: Tone;
  first?: boolean;
  /** Compacted row height; falls back to the designed 46px. */
  height?: number;
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
        height !== undefined && { height },
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
  // Fills the sheet's content box so the footer below can pin to its bottom
  // (see `footer`, which does the pinning with an auto top margin).
  host: { flex: 1 },
  // `flexShrink` (not `flex: 1`): the body takes only the room it needs on a
  // tall screen — keeping the footer directly under the keypad rather than
  // stranded at the bottom of a half-empty sheet — but yields space to the
  // pinned footer first when the sheet is too short for both.
  bodyScroll: { flexShrink: 1, flexGrow: 0 },
  bodyContent: { flexGrow: 0 },
  container: {
    // gap is supplied per-render so it can compact with the rest of the form.
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleWrap: { flex: 1 },
  amountBlock: { alignItems: 'center', gap: 6, paddingVertical: 2 },
  rowsCard: {
    borderRadius: metrics.heroRadius,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 46,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    gap: 12,
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
  noteInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 0,
    fontSize: 14.5,
    fontWeight: '600',
    textAlign: 'right',
  },
  cta: {
    height: metrics.ctaHeight,
    borderRadius: metrics.ctaRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `marginTop: 'auto'` is what actually pins the footer to the bottom of the
  // host. `host` is `flex: 1` and `bodyScroll` deliberately sizes to its content
  // (`flexGrow: 0`), so on a tall sheet the leftover space used to collect
  // *below* the footer — Entry always opens at the max detent
  // (`defaultHeightRatio={1}` in Root), so that slack stranded the CTA ~100px
  // above the sheet's bottom edge instead of a 28px breath. An auto top margin
  // absorbs the slack above the footer instead, and resolves to 0 once the body
  // fills the sheet, so the too-short case still yields room to the footer first.
  footer: { marginTop: 'auto' },
  deleteRow: {
    minHeight: 44,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryWarning: { textAlign: 'center' },
});
