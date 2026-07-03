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
        premium={false}
        onChangeCurrency={() => {}}
        onChangeExpCats={() => {}}
        onChangeIncCats={() => {}}
        onTogglePremium={() => {}}
        onLoadSample={() => {}}
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
});
