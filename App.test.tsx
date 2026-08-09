let mockStoreReady = true;
let mockPersistenceNotice: string | null = null;
const mockRetryQuickEntrySnapshot = jest.fn(async () => true);

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
    persistenceNotice: mockPersistenceNotice,
    retryQuickEntrySnapshot: mockRetryQuickEntrySnapshot,
    reconcileQuickEntries: jest.fn(),
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
import { Linking } from 'react-native';

import { settleInitialRead } from './test-utils/settleMotion';
import App from './App';

describe('App opening handoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreReady = true;
    mockPersistenceNotice = null;
    mockRetryQuickEntrySnapshot.mockClear();
  });

  it('mounts the ready Calendar behind the opening until its exit finishes', async () => {
    render(<App />);
    await settleInitialRead();

    expect(screen.getByText('Opening Kaji')).toBeTruthy();
    expect(screen.getByText('App ready')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Finish opening' }));

    expect(screen.getByText('App ready')).toBeTruthy();
    expect(screen.queryByText('Opening Kaji')).toBeNull();
  });

  it('keeps the native splash up and providers unmounted until hydration', async () => {
    mockStoreReady = false;
    const view = render(<App />);

    expect(screen.queryByText('Opening Kaji')).toBeNull();
    expect(screen.queryByText('App ready')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    mockStoreReady = true;
    view.rerender(<App />);
    await settleInitialRead();

    expect(screen.getByText('Opening Kaji')).toBeTruthy();
    expect(screen.getByText('App ready')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('reads the cold-start URL exactly once across hydration while keeping one listener', async () => {
    const getInitialURL = jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    const addListener = jest.spyOn(Linking, 'addEventListener');
    mockStoreReady = false;
    const view = render(<App />);

    mockStoreReady = true;
    view.rerender(<App />);
    await settleInitialRead();

    expect(getInitialURL).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledTimes(1);
    getInitialURL.mockRestore();
    addListener.mockRestore();
  });

  it('retries a failed quick-entry cache on foreground without changing ledger status', () => {
    mockPersistenceNotice = 'quick-entry-cache-failed';
    const appState = require('react-native').AppState;
    const addListener = jest.spyOn(appState, 'addEventListener');
    render(<App />);
    const handler = addListener.mock.calls.at(-1)?.[1] as ((state: string) => void);
    handler('active');
    expect(mockRetryQuickEntrySnapshot).toHaveBeenCalledTimes(1);
    addListener.mockRestore();
  });
});
