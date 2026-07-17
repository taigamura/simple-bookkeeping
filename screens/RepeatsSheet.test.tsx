import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { RepeatsSheet } from './RepeatsSheet';
import type { RecurrenceRule } from '../domain';

const monthly: RecurrenceRule = {
  id: 'rent',
  start: { y: 2026, m: 0, day: 20 },
  anchorDay: 20,
  type: 'expense',
  amount: 850,
  category: 'Rent',
  note: '—',
  repeat: 'monthly',
  weekendShift: 'off',
  exceptions: [],
};

const renderSheet = (over: Partial<React.ComponentProps<typeof RepeatsSheet>> = {}) =>
  render(
    <ThemeProvider>
      <RepeatsSheet
        recurrenceRules={[]}
        today={{ y: 2026, m: 6, day: 17 }}
        symbol="¥"
        onEdit={() => {}}
        onDone={() => {}}
        {...over}
      />
    </ThemeProvider>,
  );

describe('RepeatsSheet', () => {
  it('shows where repeats are created when there are no active segments', () => {
    renderSheet();

    expect(screen.getByText('No active repeats')).toBeTruthy();
    expect(screen.getByText('Create one by setting Repeat on a new entry.')).toBeTruthy();
  });

  it('returns to Settings from the back button', () => {
    const onDone = jest.fn();
    renderSheet({ onDone });

    fireEvent.press(screen.getByLabelText('Back'));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows the next occurrence summary and opens it for editing', () => {
    const onEdit = jest.fn();
    renderSheet({ recurrenceRules: [monthly], onEdit });

    expect(screen.getByText('Rent')).toBeTruthy();
    expect(screen.getByText('−¥850')).toBeTruthy();
    expect(screen.getByText('Every month · Next Jul 20, 2026')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Edit repeat: Rent'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ day: 20, repeat: 'monthly' }));
  });

  it('labels the exclusive cutoff for a bounded active segment', () => {
    renderSheet({ recurrenceRules: [{ ...monthly, endsBefore: '2026-09-20' }] });

    expect(screen.getByText('Ends before Sep 20, 2026')).toBeTruthy();
  });
});
