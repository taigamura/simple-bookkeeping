/**
 * BudgetsSheet standalone tests (#49): every expense category gets an amount
 * field, typing stores a budget, blanking clears it, existing amounts show,
 * and the back chevron button fires the drill-out callback (#59). Rendered
 * outside any bottom sheet via the default ScrollContainer, like the SettingsSheet suite.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { BudgetsSheet } from './BudgetsSheet';

const renderSheet = (over: Partial<React.ComponentProps<typeof BudgetsSheet>> = {}) =>
  render(
    <ThemeProvider>
      <BudgetsSheet
        expCats={['Food', 'Rent', 'Transport']}
        budgets={{}}
        symbol="¥"
        onChangeBudgets={() => {}}
        onDone={() => {}}
        {...over}
      />
    </ThemeProvider>,
  );

describe('BudgetsSheet', () => {
  it('lists every expense category with its own amount field', () => {
    renderSheet();
    for (const cat of ['Food', 'Rent', 'Transport']) {
      expect(screen.getByText(cat)).toBeTruthy();
      expect(screen.getByLabelText(`Budget for ${cat}`)).toBeTruthy();
    }
  });

  it('fires onDone from the back chevron button (returns to Settings, #59)', () => {
    const onDone = jest.fn();
    renderSheet({ onDone });
    fireEvent.press(screen.getByLabelText('Back'));
    expect(onDone).toHaveBeenCalled();
  });

  it('stores a budget when an amount is typed', () => {
    const onChangeBudgets = jest.fn();
    renderSheet({ onChangeBudgets });
    fireEvent.changeText(screen.getByLabelText('Budget for Food'), '30000');
    expect(onChangeBudgets).toHaveBeenCalledWith({ Food: 30000 });
  });

  it('clears the budget when the field is blanked', () => {
    const onChangeBudgets = jest.fn();
    renderSheet({ budgets: { Food: 30000, Rent: 80000 }, onChangeBudgets });
    fireEvent.changeText(screen.getByLabelText('Budget for Food'), '');
    expect(onChangeBudgets).toHaveBeenCalledWith({ Rent: 80000 });
  });

  it('seeds each field with the stored amount', () => {
    renderSheet({ budgets: { Rent: 80000 } });
    expect(screen.getByLabelText('Budget for Rent').props.value).toBe('80000');
    expect(screen.getByLabelText('Budget for Food').props.value).toBe('');
  });

  it('strips non-digit input before storing', () => {
    const onChangeBudgets = jest.fn();
    renderSheet({ onChangeBudgets });
    fireEvent.changeText(screen.getByLabelText('Budget for Food'), '1,200円');
    expect(onChangeBudgets).toHaveBeenCalledWith({ Food: 1200 });
  });

  it('shows the chosen currency symbol on each row', () => {
    renderSheet({ symbol: '€' });
    expect(screen.getAllByText('€')).toHaveLength(3);
  });

  it('scrolls its rows through a custom ScrollContainer when one is supplied', () => {
    const ScrollContainer = jest.fn(({ children }) => <>{children}</>);
    renderSheet({ ScrollContainer });
    expect(ScrollContainer).toHaveBeenCalled();
    expect(screen.getByText('Food')).toBeTruthy();
  });
});
