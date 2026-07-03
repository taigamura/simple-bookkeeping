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
import { SegmentedToggle } from '../ui';
import { useTheme, accents, metrics, Txt, type ThemeMode } from '../theme';

interface SettingsSheetProps {
  currency: Currency;
  expCats: string[];
  incCats: string[];
  onChangeCurrency: (currency: Currency) => void;
  onChangeExpCats: (list: string[]) => void;
  onChangeIncCats: (list: string[]) => void;
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
  onClose,
}: SettingsSheetProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Txt variant="screenTitle">Settings</Txt>
        <IconButton name="x" accessibilityLabel="Close" onPress={onClose} />
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
      </ScrollView>
    </View>
  );
}

/** Manual Dark/Light switch (decision 9 — no OS-appearance theming). */
function Appearance() {
  const { mode, setMode } = useTheme();
  return (
    <Section label="Appearance">
      <SegmentedToggle<ThemeMode>
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        value={mode}
        onChange={setMode}
      />
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
  const { colors } = useTheme();
  return (
    <Section label="Currency">
      <View style={styles.grid}>
        {CURRENCIES.map((c) => {
          const active = c.code === value.code;
          return (
            <Pressable
              key={c.code}
              onPress={() => onChange(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${c.code} ${c.symbol}`}
              style={[
                styles.currencyTile,
                { backgroundColor: active ? accents.positive : colors.card2 },
              ]}
            >
              <Txt variant="screenTitle" tone={active ? 'onPositive' : 'ink'}>
                {c.symbol}
              </Txt>
              <Txt variant="microLabel" tone={active ? 'onPositive' : 'dim'}>
                {c.code}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </Section>
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
    <Section label="Categories">
      <SegmentedToggle<TxType>
        options={CAT_TABS}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setDraft('');
        }}
      />

      <View style={styles.catList}>
        {list.map((cat, i) => (
          <View key={cat} style={[styles.catRow, { backgroundColor: colors.card2 }]}>
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
  grid: { flexDirection: 'row', gap: 8 },
  currencyTile: {
    flex: 1,
    height: 64,
    borderRadius: metrics.iconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  catList: { gap: 8 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    borderRadius: metrics.iconTileRadius,
    paddingHorizontal: 10,
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
