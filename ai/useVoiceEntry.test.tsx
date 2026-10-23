/**
 * Hold-to-speak flow (PRD #145) against the deterministic fake: hold → live
 * partials → release → parse → `onParsed`; the quiet failure paths.
 */
import { act, renderHook } from '@testing-library/react-native';

import { strings } from '../i18n';
import type { ParseContext, SuitoAi } from './contract';
import { createFakeSuitoAi } from './fake';
import { MIN_HOLD_MS, useVoiceEntry } from './useVoiceEntry';

const ctx: ParseContext = {
  expCats: ['Food', 'Transport'],
  incCats: ['Salary'],
  today: { y: 2026, m: 9, day: 23 },
  locale: 'en',
};

function setup(ai: SuitoAi, active = true) {
  const onParsed = jest.fn();
  const hook = renderHook(
    ({ on }: { on: boolean }) =>
      useVoiceEntry({ ai, locale: 'en', parseContext: () => ctx, onParsed, active: on }),
    { initialProps: { on: active } },
  );
  return { ...hook, onParsed };
}

/** Let promise chains (startListening/stopListening/parseEntry) resolve. */
const flush = () => act(async () => {});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useVoiceEntry', () => {
  it('hold → partials stream → release → parsed entry for the Entry sheet', async () => {
    const { result, onParsed } = setup(createFakeSuitoAi());
    act(() => result.current.start());
    expect(result.current.phase).toBe('listen');
    await flush();

    act(() => jest.advanceTimersByTime(80));
    expect(result.current.partial).toBe('lunch');
    expect(result.current.level).toBeGreaterThan(0);
    act(() => jest.advanceTimersByTime(MIN_HOLD_MS));
    expect(result.current.partial).toBe('lunch 850 yesterday');

    act(() => result.current.release());
    await flush();
    expect(onParsed).toHaveBeenCalledWith(expect.objectContaining({
      amount: 850,
      category: 'Food',
      date: { y: 2026, m: 9, day: 22 },
    }));
    expect(result.current.phase).toBe('idle');
    expect(result.current.message).toBeNull();
  });

  it('shows the thinking state between release and the parse', async () => {
    const ai = createFakeSuitoAi({ latencyMs: 300 });
    const { result, onParsed } = setup(ai);
    act(() => result.current.start());
    await flush();
    act(() => jest.advanceTimersByTime(MIN_HOLD_MS + 100));
    act(() => result.current.release());
    expect(result.current.phase).toBe('think');
    // Fake latency hits stopListening, then parseEntry.
    for (let i = 0; i < 2; i++) {
      expect(onParsed).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      await flush();
    }
    expect(onParsed).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('a short release cancels quietly with a hint', async () => {
    const ai = createFakeSuitoAi();
    const cancel = jest.spyOn(ai, 'cancelListening');
    const stop = jest.spyOn(ai, 'stopListening');
    const { result, onParsed } = setup(ai);
    act(() => result.current.start());
    await flush();
    act(() => jest.advanceTimersByTime(200));
    act(() => result.current.release());
    await flush();
    expect(cancel).toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(onParsed).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
    expect(result.current.message).toBe(strings.ai.orb.tooShort);
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current.message).toBeNull();
  });

  it('a plain tap (release without a hold) does nothing', async () => {
    const ai = createFakeSuitoAi();
    const stop = jest.spyOn(ai, 'stopListening');
    const { result } = setup(ai);
    act(() => result.current.release());
    await flush();
    expect(stop).not.toHaveBeenCalled();
    expect(result.current.message).toBeNull();
  });

  it('denied shows the Settings hint and stays idle', async () => {
    const { result, onParsed } = setup(createFakeSuitoAi({ listenStart: 'denied' }));
    act(() => result.current.start());
    await flush();
    expect(result.current.phase).toBe('idle');
    expect(result.current.message).toBe(strings.ai.orb.denied);
    act(() => result.current.release());
    await flush();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it('nothing heard or nothing parsed: no sheet, a short message', async () => {
    const silent = createFakeSuitoAi();
    jest.spyOn(silent, 'stopListening').mockResolvedValue(null);
    const a = setup(silent);
    act(() => a.result.current.start());
    await flush();
    act(() => jest.advanceTimersByTime(MIN_HOLD_MS + 50));
    act(() => a.result.current.release());
    await flush();
    expect(a.onParsed).not.toHaveBeenCalled();
    expect(a.result.current.message).toBe(strings.ai.orb.notHeard);

    const b = setup(createFakeSuitoAi({ transcript: 'hello there' }));
    act(() => b.result.current.start());
    await flush();
    act(() => jest.advanceTimersByTime(MIN_HOLD_MS + 50));
    act(() => b.result.current.release());
    await flush();
    expect(b.onParsed).not.toHaveBeenCalled();
    expect(b.result.current.message).toBe(strings.ai.orb.notUnderstood);
  });

  it('blur and unmount cancel an open mic', async () => {
    const ai = createFakeSuitoAi();
    const cancel = jest.spyOn(ai, 'cancelListening');
    const { result, rerender, unmount, onParsed } = setup(ai);
    act(() => result.current.start());
    await flush();
    rerender({ on: false });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('idle');
    act(() => result.current.release());
    await flush();
    expect(onParsed).not.toHaveBeenCalled();

    rerender({ on: true });
    act(() => result.current.start());
    await flush();
    unmount();
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('does not start while inactive', () => {
    const ai = createFakeSuitoAi();
    const listen = jest.spyOn(ai, 'startListening');
    const { result } = setup(ai, false);
    act(() => result.current.start());
    expect(listen).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });
});
