/**
 * Representative JP-locale screen test (#29): faking a Japanese device locale
 * before anything imports `i18n` makes `strings` resolve to the `ja`
 * dictionary for this file's module registry, so CalendarScreen renders its
 * Japanese copy without any Settings-side language control.
 */
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'ja', languageTag: 'ja-JP' }],
}));

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../theme';
import { CalendarScreen } from './CalendarScreen';

describe('CalendarScreen (ja locale)', () => {
  it('renders Japanese copy for the empty-day state and header actions', () => {
    render(
      <ThemeProvider>
        <CalendarScreen
          entries={[]}
          budgets={{}}
          y={2026}
          m={6}
          day={1}
          symbol="¥"
          onSelectDay={() => {}}
          onEditEntry={() => {}}
          onPrevMonth={() => {}}
          onNextMonth={() => {}}
          onMonthChange={() => {}}
          onSettings={() => {}}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText('この日の記録はありません。＋をタップして追加しましょう。')).toBeTruthy();
    expect(screen.getByLabelText('設定')).toBeTruthy();
    expect(screen.getByLabelText('前の月')).toBeTruthy();
    expect(screen.getByLabelText('次の月')).toBeTruthy();
    expect(screen.getByText('収入')).toBeTruthy();
    expect(screen.getByText('支出')).toBeTruthy();
  });
});
