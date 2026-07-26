import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) => {
    const MockView = require('react-native').View;
    return <MockView testID="bottom-sheet-modal-provider">{children}</MockView>;
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => {
    const MockView = require('react-native').View;
    return <MockView testID="safe-area-provider">{children}</MockView>;
  },
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const MockView = require('react-native').View;
    return <MockView testID="native-safe-area">{children}</MockView>;
  },
}));

import { ThemeProvider } from '../theme';
import { AppShell } from './AppShell';

describe('AppShell (native)', () => {
  it('hosts bottom-sheet portals outside the already-inset safe-area view', () => {
    render(
      <ThemeProvider>
        <AppShell>
          <View testID="app-content" />
        </AppShell>
      </ThemeProvider>,
    );

    const modalProvider = screen.getByTestId('bottom-sheet-modal-provider');
    expect(modalProvider.findByProps({ testID: 'native-safe-area' })).toBeTruthy();
  });
});
