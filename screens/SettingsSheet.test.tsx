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
        onOpenBudgets={() => {}}
        onLoadSample={() => {}}
        onExportData={() => {}}
        onImportZaim={() => {}}
        hasCorruptStash={false}
        onExportCorruptStash={() => {}}
        lockEnabled={false}
        lockAvailable={true}
        onToggleLock={() => {}}
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

  it('fires onToggleLock when the Lock switch is available and pressed (#30)', () => {
    const onToggleLock = jest.fn();
    renderSheet({ lockEnabled: false, lockAvailable: true, onToggleLock });
    fireEvent.press(screen.getByLabelText('Lock'));
    expect(onToggleLock).toHaveBeenCalledWith(true);
  });

  it('disables the Lock switch and shows an explanation when unavailable on this device (#30)', () => {
    const onToggleLock = jest.fn();
    renderSheet({ lockEnabled: false, lockAvailable: false, onToggleLock });
    const lockSwitch = screen.getByLabelText('Lock');
    expect(lockSwitch.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(lockSwitch);
    expect(onToggleLock).not.toHaveBeenCalled();
    expect(
      screen.getByText('Set up Face ID, Touch ID, or a passcode on this device to use this.'),
    ).toBeTruthy();
  });

  it('scrolls its rows through a custom ScrollContainer when one is supplied (#44)', () => {
    const ScrollContainer = jest.fn(({ children }) => <>{children}</>);
    renderSheet({ ScrollContainer });
    expect(ScrollContainer).toHaveBeenCalled();
    expect(screen.getByText('Food')).toBeTruthy();
  });

  it('shows the persisted enabled state truthfully even when availability is false (#55 never-trap)', () => {
    const onToggleLock = jest.fn();
    renderSheet({ lockEnabled: true, lockAvailable: false, onToggleLock });
    const lockSwitch = screen.getByLabelText('Lock');
    // Toggle shows ON state (enabled=true), despite availability=false
    expect(lockSwitch.props.accessibilityState.checked).toBe(true);
  });

  it('allows turning off the lock even when availability is false (#55 never-trap)', () => {
    const onToggleLock = jest.fn();
    renderSheet({ lockEnabled: true, lockAvailable: false, onToggleLock });
    const lockSwitch = screen.getByLabelText('Lock');
    // Toggle is NOT disabled (can always turn off)
    expect(lockSwitch.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(lockSwitch);
    expect(onToggleLock).toHaveBeenCalledWith(false);
  });

  it('disables the toggle only when lock is off AND availability is false (#55 never-trap)', () => {
    const onToggleLock = jest.fn();
    renderSheet({ lockEnabled: false, lockAvailable: false, onToggleLock });
    const lockSwitch = screen.getByLabelText('Lock');
    // Toggle is disabled (can't turn on unavailable)
    expect(lockSwitch.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(lockSwitch);
    expect(onToggleLock).not.toHaveBeenCalled();
  });

  it('enables the toggle when lock is on, regardless of availability (#55 never-trap)', () => {
    const onToggleLock = jest.fn();
    renderSheet({ lockEnabled: true, lockAvailable: true, onToggleLock });
    const lockSwitch = screen.getByLabelText('Lock');
    // Toggle is NOT disabled (can always turn off)
    expect(lockSwitch.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(lockSwitch);
    expect(onToggleLock).toHaveBeenCalledWith(false);
  });
});
