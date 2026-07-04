/**
 * SettingsSheet — the Settings sheet body (slice #7). Three sections:
 * Appearance (Dark/Light), Currency (4-grid, symbol-swap only — decision 11),
 * and Categories (Expense/Income sub-tabs; each row = 2-letter code tile + label
 * + ↑/↓/✕; add field + green Add).
 *
 * Presentational only: currency and the two category lists come in as props and
 * changes are pushed straight back up via the callbacks (the parent persists).
 * Appearance still uses the theme context, which persists on its own.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  CURRENCIES,
  addCategory,
  code,
  moveCategory,
  removeCategory,
  type Currency,
  type TxType,
} from '../domain';
import { IconButton } from '../nav/IconButton';
import { useTheme, accents, metrics, Txt, type ThemeMode } from '../theme';

interface SettingsSheetProps {
  currency: Currency;
  expCats: string[];
  incCats: string[];
  onChangeCurrency: (currency: Currency) => void;
  onChangeExpCats: (list: string[]) => void;
  onChangeIncCats: (list: string[]) => void;
  onLoadSample: () => void;
  onExportData: () => void;
  onImportZaim: () => void;
  onClose: () => void;
}

const CAT_TABS = [
  { value: 'expense' as TxType, label: 'Expense' },
  { value: 'income' as TxType, label: 'Income' },
];

export function SettingsSheet({
  currency,
  expCats,
  incCats,
  onChangeCurrency,
  onChangeExpCats,
  onChangeIncCats,
  onLoadSample,
  onExportData,
  onImportZaim,
  onClose,
}: SettingsSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Txt variant="screenTitle">Settings</Txt>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={8}
        >
          <Txt variant="listItem" tone="positive">
            Done
          </Txt>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        <Appearance />
        <CurrencyGrid value={currency} onChange={onChangeCurrency} />
        <Categories
          expCats={expCats}
          incCats={incCats}
          onChangeExpCats={onChangeExpCats}
          onChangeIncCats={onChangeIncCats}
        />
        <DataActions
          onLoadSample={onLoadSample}
          onExportData={onExportData}
          onImportZaim={onImportZaim}
        />
      </ScrollView>
    </View>
  );
}

/** Manual Dark/Light switch (decision 9 — no OS-appearance theming). */
function Appearance() {
  const { mode, setMode } = useTheme();
  const MODES: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
  ];
  return (
    <Section label="Appearance">
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

/** Currency 4-grid — each tile swaps the symbol only (no FX). */
function CurrencyGrid({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (currency: Currency) => void;
}) {
  return (
    <Section label="Currency">
      <View style={styles.optRow}>
        {CURRENCIES.map((c) => (
          <OptBox
            key={c.code}
            label={`${c.symbol} ${c.code}`}
            active={c.code === value.code}
            accessibilityLabel={`${c.code} ${c.symbol}`}
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
  onPress,
}: {
  label: string;
  active: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
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
          Categories
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
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
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
              accessibilityLabel={`Move ${cat} up`}
              onPress={() => apply(moveCategory(list, i, -1))}
            />
            <IconButton
              name="arrow-down"
              size={15}
              accessibilityLabel={`Move ${cat} down`}
              onPress={() => apply(moveCategory(list, i, 1))}
            />
            <IconButton
              name="x"
              size={15}
              tone="negative"
              accessibilityLabel={`Remove ${cat}`}
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
          placeholder="Add category"
          placeholderTextColor={colors.dim}
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
          accessibilityLabel="Add category"
          style={[
            styles.addBtn,
            {
              backgroundColor: accents.positive,
              opacity: draft.trim().length === 0 ? 0.4 : 1,
            },
          ]}
        >
          <Txt variant="listItem" tone="onPositive">
            Add
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Load-sample-data (decision 8, #12), Export/Import-from-Zaim (#24, #12).
 * Premium/ads stripped for v1 (#23).
 */
function DataActions({
  onLoadSample,
  onExportData,
  onImportZaim,
}: {
  onLoadSample: () => void;
  onExportData: () => void;
  onImportZaim: () => void;
}) {
  const { colors } = useTheme();
  const rowStyle = ({ pressed }: { pressed: boolean }) => [
    styles.sampleBtn,
    { backgroundColor: pressed ? colors.card3 : colors.card2 },
  ];
  return (
    <Section label="Data">
      <Pressable
        onPress={onLoadSample}
        accessibilityRole="button"
        accessibilityLabel="Load sample data"
        style={rowStyle}
      >
        <Txt variant="listItem" tone="ink">
          Load sample data
        </Txt>
      </Pressable>

      <Pressable
        onPress={onExportData}
        accessibilityRole="button"
        accessibilityLabel="Export data"
        style={rowStyle}
      >
        <Txt variant="listItem" tone="ink">
          Export data
        </Txt>
      </Pressable>

      <Pressable
        onPress={onImportZaim}
        accessibilityRole="button"
        accessibilityLabel="Import from Zaim"
        style={rowStyle}
      >
        <Txt variant="listItem" tone="ink">
          Import from Zaim
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
  container: { gap: 4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scroll: { maxHeight: 460 },
  scrollBody: { gap: 22, paddingBottom: 4 },
  section: { gap: 10 },
  sampleBtn: {
    height: 46,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
