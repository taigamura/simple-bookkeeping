/**
 * BudgetsSheet standalone tests (#49/#66): in category mode, every expense
 * category gets an amount field; in total mode, a single amount field for the
 * month. Typing stores a budget, blanking clears it, amounts persist, and the
 * back chevron fires the drill-out callback. Toggle switches modes losslessly.
 * Rendered outside any bottom sheet via the default ScrollContainer.
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
        budgetMode="category"
        totalBudget={0}
        symbol="¥"
        onChangeBudgets={() => {}}
        onChangeBudgetMode={() => {}}
        onChangeTotalBudget={() => {}}
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

  it('shows the toggle with per-category and total options', () => {
    renderSheet();
    expect(screen.getByText('Per category')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('exposes budget mode selection state/value (#76)', () => {
    renderSheet({ budgetMode: 'category' });
    const perCategory = screen.getByLabelText('Per category');
    const total = screen.getByLabelText('Total');
    expect(perCategory.props.accessibilityRole).toBe('radio');
    expect(perCategory.props.accessibilityState.selected).toBe(true);
    expect(perCategory.props.accessibilityValue.text).toBe('Selected');
    expect(total.props.accessibilityValue.text).toBe('Not selected');
  });

  it('in category mode, displays per-category amount fields', () => {
    renderSheet({ budgetMode: 'category' });
    for (const cat of ['Food', 'Rent', 'Transport']) {
      expect(screen.getByLabelText(`Budget for ${cat}`)).toBeTruthy();
    }
  });

  it('in total mode, displays a single total amount field', () => {
    renderSheet({ budgetMode: 'total', totalBudget: 50000 });
    expect(screen.getByLabelText('Total budget')).toBeTruthy();
    expect(screen.getByLabelText('Total budget').props.value).toBe('50000');
    expect(screen.queryByLabelText('Budget for Food')).toBeNull();
  });

  it('fires onChangeBudgetMode when toggling mode', () => {
    const onChangeBudgetMode = jest.fn();
    renderSheet({ onChangeBudgetMode });
    fireEvent.press(screen.getByText('Total'));
    expect(onChangeBudgetMode).toHaveBeenCalledWith('total');
  });

  it('stores a total budget when an amount is typed in total mode', () => {
    const onChangeTotalBudget = jest.fn();
    renderSheet({ budgetMode: 'total', onChangeTotalBudget });
    fireEvent.changeText(screen.getByLabelText('Total budget'), '100000');
    expect(onChangeTotalBudget).toHaveBeenCalledWith(100000);
  });

  it('exposes blank and populated field values for screen readers (#76)', () => {
    renderSheet({ budgets: { Food: 30000 } });
    expect(screen.getByLabelText('Budget for Food').props.accessibilityValue.text).toBe('¥30000');
    expect(screen.getByLabelText('Budget for Rent').props.accessibilityValue.text).toBe('None');
  });

  it('clears the total budget when the field is blanked in total mode', () => {
    const onChangeTotalBudget = jest.fn();
    renderSheet({ budgetMode: 'total', totalBudget: 50000, onChangeTotalBudget });
    fireEvent.changeText(screen.getByLabelText('Total budget'), '');
    expect(onChangeTotalBudget).toHaveBeenCalledWith(0);
  });
});
