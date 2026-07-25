/**
 * ListRow render test (design fidelity §2): the row shows the category as its
 * title and the note as its subtitle (both always), plus the direction-tinted
 * signed amount. The top divider is present only when the row is not first.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { type Transaction } from '../domain';
import { ThemeProvider } from '../theme';
import { ListRow } from './ListRow';

const entry = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  y: 2026,
  m: 6,
  day: 2,
  timestamp: '2026-07-02T04:05:00.000Z',
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

  it('shows a localized time for the item timestamp', () => {
    const timestamp = '2026-07-02T04:05:00.000Z';
    renderRow({ entry: entry({ timestamp }) });
    const expected = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));

    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('marks a legacy backfilled timestamp as inferred', () => {
    const timestamp = '2026-07-02T12:00:00.000Z';
    renderRow({ entry: entry({ timestamp, timestampInferred: true }) });
    const expected = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));

    expect(screen.getByText(`~${expected}`)).toBeTruthy();
  });

  it('uses invariant right-aligned columns for timestamps and amounts', () => {
    const firstTimestamp = '2026-07-02T04:05:00.000Z';
    const secondTimestamp = '2026-07-02T12:45:00.000Z';
    render(
      <ThemeProvider>
        <View>
          <ListRow entry={entry({ id: 'short', timestamp: firstTimestamp, amount: 1 })} />
          <ListRow
            entry={entry({
              id: 'long',
              timestamp: secondTimestamp,
              timestampInferred: true,
              amount: 999999,
            })}
          />
        </View>
      </ThemeProvider>,
    );

    const formatTime = (timestamp: string) =>
      new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(timestamp));
    const timestampStyles = [
      screen.getByText(formatTime(firstTimestamp)),
      screen.getByText(`~${formatTime(secondTimestamp)}`),
    ].map((node) => StyleSheet.flatten(node.props.style));
    const amountStyles = [
      screen.getByText('−¥1'),
      screen.getByText('−¥999,999'),
    ].map((node) => StyleSheet.flatten(node.props.style));

    expect(timestampStyles.map((style) => style.width)).toEqual([72, 72]);
    expect(timestampStyles.map((style) => style.textAlign)).toEqual(['right', 'right']);
    expect(amountStyles.map((style) => style.width)).toEqual([112, 112]);
    expect(amountStyles.map((style) => style.textAlign)).toEqual(['right', 'right']);
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

  it('is a plain (non-pressable) row with no onPress', () => {
    renderRow();
    expect(screen.queryByLabelText('Edit Food')).toBeNull();
  });

  it('fires onPress (edit wiring) when tapped, exposing an Edit label', () => {
    const onPress = jest.fn();
    renderRow({ onPress });
    fireEvent.press(screen.getByLabelText('Edit Food'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('suppresses the trailing row press while a swipe gesture is settling', () => {
    const onPress = jest.fn();
    renderRow({ onPress, onDelete: () => {} });
    const swipeable = screen.getByTestId('swipeable-t1');
    const edit = screen.getByLabelText('Edit Food');

    fireEvent(swipeable, 'swipeableOpenStartDrag', 'right');
    fireEvent.press(edit);
    expect(onPress).not.toHaveBeenCalled();

    fireEvent(swipeable, 'swipeableOpen', 'right');
    fireEvent.press(edit);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reveals a Delete action for swipe-to-delete rows', () => {
    const onDelete = jest.fn();
    renderRow({ onDelete });

    fireEvent.press(screen.getByLabelText('Delete Food'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
