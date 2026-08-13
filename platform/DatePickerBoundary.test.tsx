import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DatePickerBoundary, dateFromRecurrence, formatPickerDate, recurrenceFromDate } from './DatePickerBoundary';

describe('DatePickerBoundary', () => {
  it('round-trips leap-day dates without a timezone shift', () => {
    const value = { y: 2028, m: 1, day: 29 };
    expect(formatPickerDate(recurrenceFromDate(dateFromRecurrence(value)))).toBe('2028-02-29');
  });

  it('keeps the native trigger readable and exposes its date to assistive technology', () => {
    render(<DatePickerBoundary value={{ y: 2026, m: 6, day: 2 }} today={{ y: 2026, m: 6, day: 26 }} label="Date YYYY-MM-DD" onChange={() => {}} />);
    const trigger = screen.getByLabelText('Date YYYY-MM-DD');
    expect(trigger.props.accessibilityValue.text).toBe('2026-07-02');
    expect(trigger.props.value).toBe('2026-07-02');
  });

  it('supports cancellation, Today, and Done without committing a cancelled draft', () => {
    if (Platform.OS !== 'ios') return;
    const onChange = jest.fn();
    render(<DatePickerBoundary value={{ y: 2026, m: 1, day: 28 }} today={{ y: 2026, m: 6, day: 26 }} label="Date" onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Date'));
    expect(screen.getByLabelText('Cancel')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Today'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Date'));
    fireEvent.press(screen.getByLabelText('Today'));
    fireEvent.press(screen.getByLabelText('Done'));
    expect(onChange).toHaveBeenCalledWith({ y: 2026, m: 6, day: 26 });
  });

  it('rejects invalid browser boundary values', () => {
    if (Platform.OS !== 'web') return;
    const onChange = jest.fn();
    render(<DatePickerBoundary value={{ y: 2026, m: 1, day: 28 }} today={{ y: 2026, m: 6, day: 26 }} label="Date" onChange={onChange} />);
    fireEvent(screen.getByLabelText('Date'), 'change', { target: { value: '2026-02-30' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
