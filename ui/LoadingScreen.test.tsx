import React from 'react';
import { act, render } from '@testing-library/react-native';

import { en, ja, strings } from '../i18n';

let mockMotionEnabled = true;
let mockMotionResolved = true;

jest.mock('../theme', () => ({
  easings: { standard: jest.fn(), exit: jest.fn(), screen: jest.fn() },
  metrics: { screenPadX: 20 },
  springs: { snap: {} },
  useMotion: () => ({ enabled: mockMotionEnabled, resolved: mockMotionResolved }),
  withAppSequence: jest.fn((...values: unknown[]) => values.at(-1)),
  withAppSpring: jest.fn((value: unknown) => value),
  withAppTiming: jest.fn((value: unknown) => value),
}));
jest.mock('../theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      bg: '#F2F2F0',
      positive: '#2B33E8',
      deep: '#1E2499',
      brandSecondary: '#1E2499',
    },
    mode: 'light',
  }),
}));

import {
  ASSEMBLY_DURATION,
  EXIT_DURATION,
  LoadingScreen,
  TIMELINE,
} from './LoadingScreen';

const {
  withAppSequence: mockWithAppSequence,
  withAppSpring: mockWithAppSpring,
  withAppTiming: mockWithAppTiming,
} = jest.requireMock('../theme') as {
  withAppSequence: jest.Mock;
  withAppSpring: jest.Mock;
  withAppTiming: jest.Mock;
};

describe('LoadingScreen opening', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockMotionEnabled = true;
    mockMotionResolved = true;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('finishes only after the mark assembles and fades into the ready app', async () => {
    const onFinished = jest.fn();
    render(<LoadingScreen ready onFinished={onFinished} />);

    await act(async () => jest.advanceTimersByTime(ASSEMBLY_DURATION));
    expect(onFinished).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(EXIT_DURATION - 1));
    expect(onFinished).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(1));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('hands off from the native splash at the same 200pt image size', () => {
    const { getByTestId } = render(
      <LoadingScreen ready={false} onFinished={jest.fn()} />,
    );

    expect(getByTestId('splash-handoff-icon')).toHaveStyle({
      width: 200,
      height: 200,
    });
  });

  it('announces loading in the resolved locale', () => {
    const { getByLabelText } = render(
      <LoadingScreen ready={false} onFinished={jest.fn()} />,
    );

    expect(getByLabelText(strings.a11y.loadingKaji)).toBeTruthy();
    expect(en.a11y.loadingKaji).toBe('Loading Suito');
    expect(ja.a11y.loadingKaji).toBe('Suitoを読み込み中');
  });

  it('shows the complete mark and reveals the app synchronously in Reduced Motion', () => {
    mockMotionEnabled = false;
    const onFinished = jest.fn();
    const { getByTestId } = render(<LoadingScreen ready onFinished={onFinished} />);

    expect(getByTestId('splash-handoff-icon')).toHaveStyle({ opacity: 1 });
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(mockWithAppTiming).not.toHaveBeenCalled();
    expect(mockWithAppSequence).not.toHaveBeenCalled();
    expect(mockWithAppSpring).not.toHaveBeenCalled();
  });

  it('keeps the static handoff and schedules nothing while System motion resolves', () => {
    mockMotionEnabled = false;
    mockMotionResolved = false;
    const onFinished = jest.fn();
    const view = render(<LoadingScreen ready onFinished={onFinished} />);

    expect(view.getByTestId('splash-handoff-icon')).toHaveStyle({ opacity: 1 });
    expect(onFinished).not.toHaveBeenCalled();
    expect(mockWithAppTiming).not.toHaveBeenCalled();
    expect(mockWithAppSequence).not.toHaveBeenCalled();
    expect(mockWithAppSpring).not.toHaveBeenCalled();

    mockMotionResolved = true;
    view.rerender(<LoadingScreen ready onFinished={onFinished} />);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(mockWithAppTiming).not.toHaveBeenCalled();
  });

  it('holds the completed mark until the real app is ready', async () => {
    const onFinished = jest.fn();
    const view = render(<LoadingScreen ready={false} onFinished={onFinished} />);

    await act(async () => jest.advanceTimersByTime(ASSEMBLY_DURATION + EXIT_DURATION));
    expect(onFinished).not.toHaveBeenCalled();

    view.rerender(<LoadingScreen ready onFinished={onFinished} />);
    await act(async () => jest.advanceTimersByTime(EXIT_DURATION));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});

/**
 * The splash raster is an opaque picture of the *finished* mark, so a piece
 * that finishes travelling before that raster clears has done its whole
 * journey underneath a copy of itself and can only read as popping into
 * existence. That is the bug these pin: the top bar used to start its 260ms
 * travel at 60ms, so it was 95% home while the raster was still 48% opaque and
 * 0.1px from home by the time it cleared at 240ms.
 *
 * Durations, not pixels, because the curve is a taste call but "is there any
 * travel left to watch once the stage is visible" is not.
 */
describe('mark assembly vs. the splash handoff', () => {
  const pieces = [
    ['top bar', TIMELINE.top],
    ['lower bar', TIMELINE.lower],
  ] as const;

  it.each(pieces)('%s is still travelling well after the raster clears', (_name, piece) => {
    const remaining = piece.start + piece.travel - TIMELINE.handoffClear;
    // Comfortably more than a couple of frames of visible movement.
    expect(remaining).toBeGreaterThan(150);
  });

  it('starts no piece so early that it lands before the stage is visible', () => {
    for (const [, piece] of pieces) {
      expect(piece.start + piece.travel).toBeGreaterThan(TIMELINE.handoffClear);
    }
    expect(TIMELINE.dot.start).toBeGreaterThan(TIMELINE.handoffClear);
  });

  it('keeps the three pieces in order and evenly spaced', () => {
    expect(TIMELINE.top.start).toBeLessThan(TIMELINE.lower.start);
    expect(TIMELINE.lower.start).toBeLessThan(TIMELINE.dot.start);
    const first = TIMELINE.lower.start - TIMELINE.top.start;
    const second = TIMELINE.dot.start - TIMELINE.lower.start;
    expect(Math.abs(first - second)).toBeLessThanOrEqual(40);
  });

  it('leaves room for the last piece to land inside the assembly window', () => {
    expect(TIMELINE.dot.start).toBeLessThan(ASSEMBLY_DURATION);
  });
});
