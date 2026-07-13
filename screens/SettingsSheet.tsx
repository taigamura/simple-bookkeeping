/**
 * SettingsSheet — the Settings sheet body (slice #7). Three sections:
 * Appearance (Dark/Light), Currency (4-grid, symbol-swap only — decision 11),
 * and Categories (Expense/Income sub-tabs; each row = 2-letter code tile + label
 * + ↑/↓/✕; add field + green Add).
 *
 * Presentational only: currency and the two category lists come in as props and
 * changes are pushed straight back up via the callbacks (the parent persists).
 * Appearance still uses the theme context, which persists on its own.
 *
 * `ScrollContainer` (#44) defaults to RN's plain `ScrollView` (used by this
 * file's own standalone tests, which render outside any bottom sheet), while
 * the real app swaps in `@gorhom/bottom-sheet`'s `BottomSheetScrollView` so a
 * handle drag still dismisses/resizes the sheet while dragging the rows
 * scrolls them.
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
  CURRENCIES,
  addCategory,
  code,
  moveCategory,
  removeCategory,
  type Currency,
  type TxType,
} from '../domain';
import { strings } from '../i18n';
import { IconButton } from '../nav/IconButton';
import { useTheme, accents, metrics, Txt, type ThemeMode } from '../theme';

/** Minimal shape shared by RN's `ScrollView` and gorhom's `BottomSheetScrollView`. */
interface ScrollContainerProps {
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  children: ReactNode;
}

interface SettingsSheetProps {
  currency: Currency;
  expCats: string[];
  incCats: string[];
  onChangeCurrency: (currency: Currency) => void;
  onChangeExpCats: (list: string[]) => void;
  onChangeIncCats: (list: string[]) => void;
  /** Drill into the Budgets sheet (#49) — Settings dismisses, Budgets presents. */
  onOpenBudgets: () => void;
  onLoadSample: () => void;
  onExportData: () => void;
  onImportZaim: () => void;
  /** Whether a corrupt-stash blob exists (#28) — gates the recovery row. */
  hasCorruptStash: boolean;
  onExportCorruptStash: () => void;
  /** Face ID / passcode gate (#30). */
  lockEnabled: boolean;
  lockAvailable: boolean;
  onToggleLock: (enabled: boolean) => void;
  /** Delete all entries and budgets (#67). */
  onDeleteAllData: () => void;
  /** What the app opens to on launch (#68). */
  openTo: 'calendar' | 'entry';
  onChangeOpenTo: (openTo: 'calendar' | 'entry') => void;
  onClose: () => void;
  /** Scrollable wrapper for the rows below the header (#44); see file header. */
  ScrollContainer?: ComponentType<ScrollContainerProps>;
}

const CAT_TABS = [
  { value: 'expense' as TxType, label: strings.common.expense },
  { value: 'income' as TxType, label: strings.common.income },
];

export function SettingsSheet({
  currency,
  expCats,
  incCats,
  onChangeCurrency,
  onChangeExpCats,
  onChangeIncCats,
  onOpenBudgets,
  onLoadSample,
  onExportData,
  onImportZaim,
  hasCorruptStash,
  onExportCorruptStash,
  lockEnabled,
  lockAvailable,
  onToggleLock,
  onDeleteAllData,
  openTo,
  onChangeOpenTo,
  onClose,
  ScrollContainer = ScrollView as ComponentType<ScrollContainerProps>,
}: SettingsSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Txt variant="screenTitle">{strings.nav.settings}</Txt>
        <IconButton name="x" accessibilityLabel={strings.nav.close} onPress={onClose} />
      </View>
      <ScrollContainer
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        <Appearance />
        <OpenTo value={openTo} onChange={onChangeOpenTo} />
        <LockToggle enabled={lockEnabled} available={lockAvailable} onToggle={onToggleLock} />
        <CurrencyGrid value={currency} onChange={onChangeCurrency} />
        <Categories
          expCats={expCats}
          incCats={incCats}
          onChangeExpCats={onChangeExpCats}
          onChangeIncCats={onChangeIncCats}
        />
        <BudgetsLink onPress={onOpenBudgets} />
        <DataActions
          onLoadSample={onLoadSample}
          onExportData={onExportData}
          onImportZaim={onImportZaim}
          hasCorruptStash={hasCorruptStash}
          onExportCorruptStash={onExportCorruptStash}
          onDeleteAllData={onDeleteAllData}
        />
      </ScrollContainer>
    </View>
  );
}

/** Manual Dark/Light switch (decision 9 — no OS-appearance theming). */
function Appearance() {
  const { mode, setMode } = useTheme();
  const MODES: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: strings.settings.dark },
    { value: 'light', label: strings.settings.light },
  ];
  return (
    <Section label={strings.settings.appearance}>
      <View style={styles.optRow}>
        {MODES.map((m) => (
          <OptBox
            key={m.value}
            label={m.label}
            active={mode === m.value}
            onPress={() => setMode(m.value)}
          />
        ))}
      </View>
    </Section>
  );
}

/** Open-to selector: Calendar or Entry on launch (#68). */
function OpenTo({
  value,
  onChange,
}: {
  value: 'calendar' | 'entry';
  onChange: (openTo: 'calendar' | 'entry') => void;
}) {
  const OPTIONS: { value: 'calendar' | 'entry'; label: string }[] = [
    { value: 'calendar', label: strings.settings.openToCalendar },
    { value: 'entry', label: strings.settings.openToEntry },
  ];
  return (
    <Section label={strings.settings.openTo}>
      <View style={styles.optRow}>
        {OPTIONS.map((o) => (
          <OptBox
            key={o.value}
            label={o.label}
            active={value === o.value}
            onPress={() => onChange(o.value)}
          />
        ))}
      </View>
    </Section>
  );
}

/**
 * Lock toggle (#30, #55): displays the persisted enabled state truthfully
 * (not enabled-AND-available), and is disabled only when the lock is off
 * AND availability is false — turning the lock off is always possible,
 * preventing the trap where the toggle shows "off" while the lock is actually
 * on (broken availability check).
 */
function LockToggle({
  enabled,
  available,
  onToggle,
}: {
  enabled: boolean;
  available: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const { colors } = useTheme();
  const disabled = !enabled && !available;
  return (
    <View style={styles.section}>
      <Txt variant="microLabel" tone="dim">
        {strings.lock.label}
      </Txt>
      <View style={[styles.lockRow, { backgroundColor: colors.card2 }]}>
        <View style={styles.lockCopy}>
          <Txt variant="listItem" tone="ink">
            {strings.lock.label}
          </Txt>
          {!available && (
            <Txt variant="secondary" tone="dim">
              {strings.lock.unavailableExplanation}
            </Txt>
          )}
        </View>
        <Pressable
          onPress={() => onToggle(!enabled)}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled, disabled }}
          accessibilityLabel={strings.lock.label}
          accessibilityValue={{ text: enabled ? strings.common.on : strings.common.off }}
          style={[
            styles.pill,
            { backgroundColor: enabled ? accents.positive : colors.card3, opacity: disabled ? 0.5 : 1 },
          ]}
        >
          <Txt variant="microLabel" tone={enabled ? 'onPositive' : 'muted'}>
            {enabled ? strings.common.on : strings.common.off}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

/** Currency 4-grid — each tile swaps the symbol only (no FX). */
function CurrencyGrid({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (currency: Currency) => void;
}) {
  return (
    <Section label={strings.settings.currency}>
      <View style={styles.optRow}>
        {CURRENCIES.map((c) => (
          <OptBox
            key={c.code}
            label={`${c.symbol} ${c.code}`}
            active={c.code === value.code}
            accessibilityLabel={`${c.code} ${c.symbol}`}
            accessibilityHint={strings.a11y.symbolOnlyCurrencyHint}
            onPress={() => onChange(c)}
          />
        ))}
      </View>
    </Section>
  );
}

/** Selection tile shared by Appearance & Currency: green-tint + inset green ring
 *  and green text when active, else card2 with a muted label (design §9). */
const OPT_TINT = 'rgba(43,212,138,.15)';

function OptBox({
  label,
  active,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: {
  label: string;
  active: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityValue={{ text: active ? strings.a11y.selected : strings.a11y.notSelected }}
      style={[
        styles.optBox,
        active
          ? { backgroundColor: OPT_TINT, borderColor: accents.positive }
          : { backgroundColor: colors.card2, borderColor: 'transparent' },
      ]}
    >
      <Txt variant="optionLabel" tone={active ? 'positive' : 'muted'} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Category editor with Expense/Income sub-tabs. */
function Categories({
  expCats,
  incCats,
  onChangeExpCats,
  onChangeIncCats,
}: {
  expCats: string[];
  incCats: string[];
  onChangeExpCats: (list: string[]) => void;
  onChangeIncCats: (list: string[]) => void;
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<TxType>('expense');
  const [draft, setDraft] = useState('');

  const list = tab === 'income' ? incCats : expCats;
  const apply = tab === 'income' ? onChangeIncCats : onChangeExpCats;

  const add = () => {
    const nextList = addCategory(list, draft);
    if (nextList !== list) apply(nextList);
    setDraft('');
  };

  return (
    <View style={styles.section}>
      <View style={styles.catHeader}>
        <Txt variant="microLabel" tone="dim">
          {strings.settings.categories}
        </Txt>
        <View style={styles.pillGroup}>
          {CAT_TABS.map((t) => {
            const active = tab === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => {
                  setTab(t.value);
                  setDraft('');
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                accessibilityValue={{ text: active ? strings.a11y.selected : strings.a11y.notSelected }}
                style={[
                  styles.miniPill,
                  { backgroundColor: active ? accents.positive : colors.card2 },
                ]}
              >
                <Txt variant="microLabel" tone={active ? 'onPositive' : 'muted'}>
                  {t.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.catCard, { backgroundColor: colors.card2 }]}>
        {list.map((cat, i) => (
          <View
            key={cat}
            style={[
              styles.catRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hair },
            ]}
          >
            <View style={[styles.codeTile, { backgroundColor: colors.card3 }]}>
              <Txt variant="microLabel" tone="muted">
                {code(cat)}
              </Txt>
            </View>
            <Txt variant="listItem" tone="ink" style={styles.catLabel} numberOfLines={1}>
              {cat}
            </Txt>
            <IconButton
              name="arrow-up"
              size={15}
              accessibilityLabel={strings.settings.moveCategoryUp(cat)}
              onPress={() => apply(moveCategory(list, i, -1))}
            />
            <IconButton
              name="arrow-down"
              size={15}
              accessibilityLabel={strings.settings.moveCategoryDown(cat)}
              onPress={() => apply(moveCategory(list, i, 1))}
            />
            <IconButton
              name="x"
              size={15}
              tone="negative"
              accessibilityLabel={strings.settings.removeCategory(cat)}
              onPress={() => apply(removeCategory(list, i))}
            />
          </View>
        ))}
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={strings.settings.addCategory}
          placeholderTextColor={colors.dim}
          accessibilityLabel={strings.a11y.categoryName}
          accessibilityValue={{ text: draft || strings.budgets.none }}
          returnKeyType="done"
          style={[
            styles.input,
            { backgroundColor: colors.card2, color: colors.ink },
          ]}
        />
        <Pressable
          onPress={add}
          disabled={draft.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel={strings.settings.addCategory}
          accessibilityState={{ disabled: draft.trim().length === 0 }}
          style={[
            styles.addBtn,
            {
              backgroundColor: accents.positive,
              opacity: draft.trim().length === 0 ? 0.4 : 1,
            },
          ]}
        >
          <Txt variant="listItem" tone="onPositive">
            {strings.common.add}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Drill-in row to the Budgets sheet (#49): tapping swaps this sheet for the
 * Budgets one (never stacked); its Done returns here.
 */
function BudgetsLink({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Section label={strings.budgets.title}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={strings.budgets.title}
        style={({ pressed }) => [
          styles.linkRow,
          { backgroundColor: pressed ? colors.card3 : colors.card2 },
        ]}
      >
        <Txt variant="listItem" tone="ink" style={styles.linkLabel}>
          {strings.budgets.title}
        </Txt>
        <Txt variant="listItem" tone="dim">
          ›
        </Txt>
      </Pressable>
    </Section>
  );
}

/**
 * Load-sample-data (decision 8, #12), Export/Import-from-Zaim (#24, #12),
 * the conditional unreadable-backup recovery row (#28), and
 * the Delete all data action (#67). Premium/ads stripped for v1 (#23).
 */
function DataActions({
  onLoadSample,
  onExportData,
  onImportZaim,
  hasCorruptStash,
  onExportCorruptStash,
  onDeleteAllData,
}: {
  onLoadSample: () => void;
  onExportData: () => void;
  onImportZaim: () => void;
  hasCorruptStash: boolean;
  onExportCorruptStash: () => void;
  onDeleteAllData: () => void;
}) {
  const { colors } = useTheme();
  const rowStyle = ({ pressed }: { pressed: boolean }) => [
    styles.sampleBtn,
    { backgroundColor: pressed ? colors.card3 : colors.card2 },
  ];
  return (
    <Section label={strings.settings.data}>
      <Pressable
        onPress={onLoadSample}
        accessibilityRole="button"
        accessibilityLabel={strings.settings.loadSampleData}
        style={rowStyle}
      >
        <Txt variant="listItem" tone="ink">
          {strings.settings.loadSampleData}
        </Txt>
      </Pressable>

      <Pressable
        onPress={onExportData}
        accessibilityRole="button"
        accessibilityLabel={strings.settings.exportData}
        style={rowStyle}
      >
        <Txt variant="listItem" tone="ink">
          {strings.settings.exportData}
        </Txt>
      </Pressable>

      <Pressable
        onPress={onImportZaim}
        accessibilityRole="button"
        accessibilityLabel={strings.settings.importFromZaim}
        style={rowStyle}
      >
        <Txt variant="listItem" tone="ink">
          {strings.settings.importFromZaim}
        </Txt>
      </Pressable>

      {hasCorruptStash && (
        <Pressable
          onPress={onExportCorruptStash}
          accessibilityRole="button"
          accessibilityLabel={strings.settings.exportUnreadableBackup}
          style={rowStyle}
        >
          <Txt variant="listItem" tone="negative">
            {strings.settings.exportUnreadableBackup}
          </Txt>
        </Pressable>
      )}

      <Pressable
        onPress={onDeleteAllData}
        accessibilityRole="button"
        accessibilityLabel={strings.settings.deleteAllData}
        accessibilityHint={strings.settings.deleteAllDataConfirmMessage}
        style={rowStyle}
      >
        <Txt variant="listItem" tone="negative">
          {strings.settings.deleteAllData}
        </Txt>
      </Pressable>
    </Section>
  );
}

/** A titled settings block: micro-label over its content. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="microLabel" tone="dim">
        {label}
      </Txt>
      {children}
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
  scrollBody: { gap: 22, paddingBottom: 4 },
  section: { gap: 10 },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: metrics.iconTileRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockCopy: { flex: 1, gap: 2 },
  pill: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: metrics.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBtn: {
    height: 46,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    borderRadius: metrics.iconTileRadius,
    paddingHorizontal: 14,
  },
  linkLabel: { flex: 1 },
  optRow: { flexDirection: 'row', gap: 8 },
  optBox: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillGroup: { flexDirection: 'row', gap: 6 },
  miniPill: {
    paddingHorizontal: 12,
    height: 26,
    borderRadius: metrics.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCard: {
    borderRadius: 14,
    paddingHorizontal: 10,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
  },
  codeTile: {
    width: 34,
    height: 34,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: { flex: 1 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  input: {
    flex: 1,
    height: 46,
    borderRadius: metrics.iconTileRadius,
    paddingHorizontal: 14,
    fontSize: 14.5,
  },
  addBtn: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
