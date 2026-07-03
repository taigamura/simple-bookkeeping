/**
 * EntrySheet fidelity test (design §6–§8): sentence-case CTA label that flips
 * with the type toggle and is disabled at amount 0; per-type Note presets cycled
 * by the Note row (expense → 'Cash', income → 'Bank transfer').
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { EntrySheet } from './EntrySheet';

const renderSheet = () =>
  render(
    <ThemeProvider>
      <EntrySheet
        expCats={['Food', 'Rent']}
        incCats={['Salary', 'Gift']}
        y={2026}
        m={6}
        day={2}
        symbol="¥"
        showAd={false}
        onSave={() => {}}
        onClose={() => {}}
      />
    </ThemeProvider>,
  );

describe('EntrySheet', () => {
  it('shows a sentence-case CTA that is disabled until an amount is entered', () => {
    renderSheet();
    const cta = screen.getByLabelText('Add expense');
    expect(cta.props.accessibilityState.disabled).toBe(true);
  });

  it('flips the CTA label when the type toggle switches to Income', () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Income'));
    expect(screen.getByLabelText('Add income')).toBeTruthy();
  });

  it('cycles the expense Note presets starting from the default dash', () => {
    renderSheet();
    expect(screen.getByLabelText('Note: —')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Note: —'));
    expect(screen.getByLabelText('Note: Cash')).toBeTruthy();
  });

  it('uses income-specific Note presets after switching type', () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Income'));
    fireEvent.press(screen.getByLabelText('Note: —'));
    expect(screen.getByLabelText('Note: Bank transfer')).toBeTruthy();
  });

  it('defaults the Repeat row to Never', () => {
    renderSheet();
    expect(screen.getByLabelText('↻ Repeat: Never')).toBeTruthy();
  });
});
