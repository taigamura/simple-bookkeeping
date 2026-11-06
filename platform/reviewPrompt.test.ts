jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.1.0' } }));
jest.mock('expo-store-review', () => ({
  hasAction: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import {
  DAYS_BETWEEN_PROMPTS,
  PROMPT_DELAY_MS,
  REVIEW_KEY,
  SAVES_BEFORE_PROMPT,
  noteEntrySaved,
  shouldPrompt,
} from './reviewPrompt';

const NOW = new Date('2026-11-06T10:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe('shouldPrompt', () => {
  it('waits for a few saves', () => {
    expect(shouldPrompt({ saves: SAVES_BEFORE_PROMPT - 1 }, '1.1.0', NOW)).toBe(false);
    expect(shouldPrompt({ saves: SAVES_BEFORE_PROMPT }, '1.1.0', NOW)).toBe(true);
  });

  it('never asks twice for one version', () => {
    expect(
      shouldPrompt({ saves: 50, lastPromptVersion: '1.1.0', lastPromptAt: daysAgo(400) }, '1.1.0', NOW),
    ).toBe(false);
  });

  it('keeps asks far apart across versions', () => {
    const state = { saves: 50, lastPromptVersion: '1.0.1' };
    expect(shouldPrompt({ ...state, lastPromptAt: daysAgo(DAYS_BETWEEN_PROMPTS - 1) }, '1.1.0', NOW)).toBe(false);
    expect(shouldPrompt({ ...state, lastPromptAt: daysAgo(DAYS_BETWEEN_PROMPTS) }, '1.1.0', NOW)).toBe(true);
  });
});

describe('noteEntrySaved', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.useFakeTimers();
    (StoreReview.requestReview as jest.Mock).mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('asks once, after the dismiss delay, on the Nth new entry', async () => {
    for (let i = 0; i < SAVES_BEFORE_PROMPT - 1; i++) await noteEntrySaved(NOW);
    jest.advanceTimersByTime(PROMPT_DELAY_MS);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    await noteEntrySaved(NOW);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    jest.advanceTimersByTime(PROMPT_DELAY_MS);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);

    await noteEntrySaved(NOW);
    jest.advanceTimersByTime(PROMPT_DELAY_MS);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    expect(JSON.parse((await AsyncStorage.getItem(REVIEW_KEY))!)).toMatchObject({
      saves: SAVES_BEFORE_PROMPT + 1,
      lastPromptVersion: '1.1.0',
    });
  });

  it('survives corrupt bookkeeping', async () => {
    await AsyncStorage.setItem(REVIEW_KEY, '{nope');
    await noteEntrySaved(NOW);
    expect(JSON.parse((await AsyncStorage.getItem(REVIEW_KEY))!).saves).toBe(1);
  });
});
