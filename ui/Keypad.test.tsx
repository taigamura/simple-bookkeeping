/**
 * Keypad render test (slice #3 acceptance criterion). The pad is presentational,
 * so we mount it inside a tiny harness that threads presses through the domain's
 * `pressKey` and renders the resulting amount string, then assert the integer
 * rules (leading-zero strip, 9-digit cap, ⌫) hold end-to-end through the UI.
 */
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { pressKey, type KeypadKey } from '../domain';
import { ThemeProvider, Txt } from '../theme';
import { Keypad } from './Keypad';

function Harness() {
  const [amount, setAmount] = useState('');
  return (
    <ThemeProvider>
      <Txt testID="amount">{amount === '' ? 'EMPTY' : amount}</Txt>
      <Keypad onKey={(key: KeypadKey) => setAmount((s) => pressKey(s, key))} />
    </ThemeProvider>
  );
}

const shown = () => screen.getByTestId('amount').props.children;
const tap = (label: string) => fireEvent.press(screen.getByLabelText(label));

describe('Keypad', () => {
  beforeEach(() => render(<Harness />));

  it('renders digit keys 0–9, 000 and a delete key', () => {
    for (const label of ['0', '1', '5', '9', '000', 'Delete']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('appends pressed digits', () => {
    tap('1');
    tap('2');
    tap('3');
    expect(shown()).toBe('123');
  });

  it('strips leading zeros', () => {
    tap('0');
    expect(shown()).toBe('0');
    tap('5');
    expect(shown()).toBe('5'); // leading zero collapsed, not "05"
  });

  it('caps input at 9 digits', () => {
    for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) tap(d);
    expect(shown()).toBe('123456789');
    tap('0'); // 10th digit ignored
    expect(shown()).toBe('123456789');
  });

  it('deletes the last digit with ⌫', () => {
    tap('1');
    tap('2');
    tap('Delete');
    expect(shown()).toBe('1');
  });
});
