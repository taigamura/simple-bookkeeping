let mockStoreReady = true;

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('./theme/useAppFonts', () => ({ useAppFonts: () => true }));
jest.mock('./store', () => ({
  useStore: () => ({
    ready: mockStoreReady,
    state: { theme: 'system', motion: 'system' },
    update: jest.fn(),
    showCorruptNotice: false,
    hasCorruptStash: false,
    readCorruptStash: jest.fn(),
    persistenceNotice: null,
  }),
}));
jest.mock('./nav', () => ({
  Root: () => {
    const { Text } = require('react-native');
    return <Text>App ready</Text>;
  },
}));
jest.mock('./screens/SummaryGrowthPrototype', () => ({ SummaryGrowthPrototype: () => null }));
jest.mock('./ui/LoadingScreen', () => ({
  LoadingScreen: ({ ready, onFinished }: { ready: boolean; onFinished: () => void }) => {
    const { Button, Text, View } = require('react-native');
    return (
      <View>
        <Text>Opening Kaji</Text>
        <Button
          title="Finish opening"
          disabled={!ready}
          onPress={onFinished}
        />
      </View>
    );
  },
}));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import App from './App';

describe('App opening handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreReady = true;
  });

  it('mounts the ready Calendar behind the opening until its exit finishes', () => {
    render(<App />);

    expect(screen.getByText('Opening Kaji')).toBeTruthy();
    expect(screen.getByText('App ready')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Finish opening' }));

    expect(screen.getByText('App ready')).toBeTruthy();
    expect(screen.queryByText('Opening Kaji')).toBeNull();
  });

  it('keeps the native splash up and providers unmounted until hydration', () => {
    mockStoreReady = false;
    const view = render(<App />);

    expect(screen.queryByText('Opening Kaji')).toBeNull();
    expect(screen.queryByText('App ready')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    mockStoreReady = true;
    view.rerender(<App />);

    expect(screen.getByText('Opening Kaji')).toBeTruthy();
    expect(screen.getByText('App ready')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });
});
