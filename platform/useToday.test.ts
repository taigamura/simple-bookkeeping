import { act, renderHook } from '@testing-library/react-native';

import { useToday } from './useToday';

describe('useToday', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('refreshes the local date when midnight passes', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 1, 23, 59, 30));
    const { result } = renderHook(() => useToday());
    expect(result.current.getDate()).toBe(1);

    jest.setSystemTime(new Date(2026, 6, 2, 0, 0, 30));
    act(() => jest.advanceTimersByTime(60_000));

    expect(result.current.getDate()).toBe(2);
  });
});
