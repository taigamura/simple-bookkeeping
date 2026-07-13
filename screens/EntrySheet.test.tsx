/**
 * EntrySheet fidelity test (design §6–§8): sentence-case CTA label that flips
 * with the type toggle and is disabled at amount 0; per-type Note presets cycled
 * by the Note row (expense → 'Cash', income → 'Bank transfer').
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { type Transaction } from '../domain';
import { ThemeProvider } from '../theme';
import { EntrySheet } from './EntrySheet';

const renderSheet = (props: Partial<React.ComponentProps<typeof EntrySheet>> = {}) =>
  render(
    <ThemeProvider>
      <EntrySheet
        expCats={['Food', 'Rent']}
        incCats={['Salary', 'Gift']}
        y={2026}
        m={6}
        day={2}
        symbol="¥"
        onSave={() => {}}
        onClose={() => {}}
        {...props}
      />
    </ThemeProvider>,
  );

const editingEntry = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'e1',
  y: 2026,
  m: 6,
  day: 2,
  type: 'expense',
  amount: 1200,
  category: 'Rent',
  note: 'Card',
  repeat: 'never',
  ...over,
});

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

  it('announces repeat value and save-time materialization (#76)', () => {
    renderSheet();
    const repeat = screen.getByLabelText('↻ Repeat: Never');
    expect(repeat.props.accessibilityValue.text).toBe('Never');
    expect(repeat.props.accessibilityHint).toContain('created when you save');
  });

  it('renders no ad card (Premium/ads stripped for v1, #23)', () => {
    renderSheet();
    expect(screen.queryByLabelText('Sponsored ad')).toBeNull();
  });
});

describe('EntrySheet (edit mode, #43)', () => {
  it('prefills from the edited entry (amount, note) and shows an enabled Save CTA', () => {
    renderSheet({ editing: editingEntry() });
    expect(screen.getByText('¥1,200')).toBeTruthy();
    expect(screen.getByLabelText('Note: Card')).toBeTruthy();
    const cta = screen.getByLabelText('Save');
    expect(cta.props.accessibilityState.disabled).toBe(false);
  });

  it('prefills the selected category chip', () => {
    renderSheet({ editing: editingEntry() });
    const chip = screen.getByRole('radio', { name: 'Rent' });
    expect(chip.props.accessibilityState.selected).toBe(true);
    expect(chip.props.accessibilityValue.text).toBe('Selected');
  });

  it('hides the create-only Repeat and weekend-shift rows', () => {
    renderSheet({ editing: editingEntry() });
    expect(screen.queryByLabelText('↻ Repeat: Never')).toBeNull();
    expect(screen.queryByLabelText('If on weekend: Move to Monday')).toBeNull();
  });

  it('fires onDelete with the entry id when Delete is pressed', () => {
    const onDelete = jest.fn();
    renderSheet({ editing: editingEntry(), onDelete });
    fireEvent.press(screen.getByLabelText('Delete entry'));
    expect(onDelete).toHaveBeenCalledWith('e1');
  });

  it('saves the draft (unchanged fields) for the host to overwrite', () => {
    const onSave = jest.fn();
    renderSheet({ editing: editingEntry(), onSave });
    fireEvent.press(screen.getByLabelText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [draft] = onSave.mock.calls[0];
    expect(draft).toMatchObject({ type: 'expense', amountStr: '1200', category: 'Rent', note: 'Card' });
  });

  it('shows the additive CTA and no Delete action in create mode', () => {
    renderSheet();
    expect(screen.getByLabelText('Add expense')).toBeTruthy();
    expect(screen.queryByLabelText('Delete entry')).toBeNull();
  });
});
