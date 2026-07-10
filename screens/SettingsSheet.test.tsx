/**
 * SettingsSheet fidelity test (design §9–§11): a green "Done" text button (not an
 * ✕ icon), single-line currency optBox tiles ("¥ JPY"), and the Categories
 * sub-tab as a right-aligned pill group that switches the edited list.
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
  it('closes via a green "Done" text button instead of an ✕ icon', () => {
    const onClose = jest.fn();
    renderSheet({ onClose });
    const done = screen.getByLabelText('Done');
    fireEvent.press(done);
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByLabelText('Close')).toBeNull();
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
});
