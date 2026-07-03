/**
 * ListRow render test (design fidelity §2): the row shows the category as its
 * title and the note as its subtitle (both always), plus the direction-tinted
 * signed amount. The top divider is present only when the row is not first.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { type Transaction } from '../domain';
import { ThemeProvider } from '../theme';
import { ListRow } from './ListRow';

const entry = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  y: 2026,
  m: 6,
  day: 2,
  type: 'expense',
  amount: 1200,
  category: 'Food',
  note: 'Konbini',
  repeat: 'never',
  ...over,
});

const renderRow = (props: Partial<React.ComponentProps<typeof ListRow>> = {}) =>
  render(
    <ThemeProvider>
      <ListRow entry={entry()} symbol="¥" {...props} />
    </ThemeProvider>,
  );

describe('ListRow', () => {
  it('shows the category as the title and the note as the subtitle', () => {
    renderRow();
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('Konbini')).toBeTruthy();
  });

  it('shows the note even when it equals the category', () => {
    renderRow({ entry: entry({ category: 'Food', note: 'Food' }) });
    // both title and subtitle render the same text → two nodes
    expect(screen.getAllByText('Food')).toHaveLength(2);
  });

  it('renders an expense amount with a unicode-minus prefix and the symbol', () => {
    renderRow();
    expect(screen.getByText('−¥1,200')).toBeTruthy();
  });

  it('omits the top divider on the first row', () => {
    renderRow({ first: true });
    const flat = StyleSheet.flatten(screen.getByText('Food').parent?.parent?.props.style);
    expect(flat?.borderTopWidth).toBeFalsy();
  });
});
