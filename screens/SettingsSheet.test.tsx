/**
 * SettingsSheet fidelity test (design §9–§11): ✕ icon button for close (#59),
 * single-line currency optBox tiles ("¥ JPY"), and the Categories sub-tab as a
 * right-aligned pill group that switches the edited list.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CURRENCIES } from '../domain';
import { ThemeProvider } from '../theme';
import { SettingsSheet } from './SettingsSheet';

const renderSheet = (over: Partial<React.ComponentProps<typeof SettingsSheet>> = {}) =>
  render(
    <ThemeProvider>
      <SettingsSheet
        currency={CURRENCIES[0]}
        expCats={['Food', 'Rent']}
        incCats={['Salary']}
        onChangeCurrency={() => {}}
        onChangeExpCats={() => {}}
        onChangeIncCats={() => {}}
        activeRepeatCount={0}
        onOpenRepeats={() => {}}
        onOpenBudgets={() => {}}
        onLoadSample={() => {}}
        onExportData={() => {}}
        onImportZaim={() => {}}
        hasCorruptStash={false}
        onExportCorruptStash={() => {}}
        onDeleteAllData={() => {}}
        onClose={() => {}}
        {...over}
      />
    </ThemeProvider>,
  );

describe('SettingsSheet', () => {
  it('closes via an ✕ icon button (#59)', () => {
    const onClose = jest.fn();
    renderSheet({ onClose });
    const closeButton = screen.getByLabelText('Close');
    fireEvent.press(closeButton);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByLabelText('Done')).toBeNull();
  });

  it('renders single-line currency tiles as "symbol code"', () => {
    renderSheet();
    expect(screen.getByText('¥ JPY')).toBeTruthy();
  });

  it('switches the edited category list when the Income sub-tab pill is tapped', () => {
    renderSheet();
    expect(screen.getByText('Food')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Income'));
    expect(screen.getByText('Salary')).toBeTruthy();
    expect(screen.queryByText('Food')).toBeNull();
  });

  it('renders a Budgets drill-in row that fires its callback (#49)', () => {
    const onOpenBudgets = jest.fn();
    renderSheet({ onOpenBudgets });
    fireEvent.press(screen.getByLabelText('Budgets'));
    expect(onOpenBudgets).toHaveBeenCalled();
  });

  it('always renders a Repeats drill-in row with its active segment count', () => {
    const onOpenRepeats = jest.fn();
    renderSheet({ activeRepeatCount: 2, onOpenRepeats });

    expect(screen.getByText('2 active')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Repeats'));
    expect(onOpenRepeats).toHaveBeenCalled();
  });

  it('renders an "Import from Zaim" action that fires its callback', () => {
    const onImportZaim = jest.fn();
    renderSheet({ onImportZaim });
    fireEvent.press(screen.getByLabelText('Import from Zaim'));
    expect(onImportZaim).toHaveBeenCalled();
  });

  it('renders an "Export data" action that fires its callback', () => {
    const onExportData = jest.fn();
    renderSheet({ onExportData });
    fireEvent.press(screen.getByLabelText('Export data'));
    expect(onExportData).toHaveBeenCalled();
  });

  it('renders no Premium/Remove-ads toggle (stripped for v1, #23)', () => {
    renderSheet();
    expect(screen.queryByLabelText('Remove ads')).toBeNull();
    expect(screen.queryByText('Data & Premium')).toBeNull();
  });

  it('hides "Export unreadable backup" when no corrupt stash exists', () => {
    renderSheet({ hasCorruptStash: false });
    expect(screen.queryByLabelText('Export unreadable backup')).toBeNull();
  });

  it('renders "Export unreadable backup" and fires its callback when a stash exists (#28)', () => {
    const onExportCorruptStash = jest.fn();
    renderSheet({ hasCorruptStash: true, onExportCorruptStash });
    fireEvent.press(screen.getByLabelText('Export unreadable backup'));
    expect(onExportCorruptStash).toHaveBeenCalled();
  });

  it('scrolls its rows through a custom ScrollContainer when one is supplied (#44)', () => {
    const ScrollContainer = jest.fn(({ children }) => <>{children}</>);
    renderSheet({ ScrollContainer });
    expect(ScrollContainer).toHaveBeenCalled();
    expect(screen.getByText('Food')).toBeTruthy();
  });

  it('renders a "Delete all data" action that fires its callback (#67)', () => {
    const onDeleteAllData = jest.fn();
    renderSheet({ onDeleteAllData });
    const deleteAll = screen.getByLabelText('Delete all data');
    expect(deleteAll.props.accessibilityHint).toContain('entries, repeating series, and budgets');
    fireEvent.press(deleteAll);
    expect(onDeleteAllData).toHaveBeenCalled();
  });

  it('labels the category input and disabled Add button for accessibility (#76)', () => {
    renderSheet();
    expect(screen.getByLabelText('Category name').props.accessibilityValue.text).toBe('None');
    expect(screen.getByLabelText('Add category').props.accessibilityState.disabled).toBe(true);
  });

  it('describes currency as symbol-only, not conversion (#76)', () => {
    renderSheet();
    expect(screen.getByLabelText('JPY ¥').props.accessibilityHint).toContain('symbol only');
  });
});
