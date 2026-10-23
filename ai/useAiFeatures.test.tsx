/**
 * Letter + nudge orchestration. The domain functions (`buildFacts`,
 * `renderCited`, `citedIds`) are replaced with local fakes so these tests pin
 * the orchestration alone, whatever the domain slice's real output is.
 */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DEFAULT_STATE, type AppState } from '../store/schema';
import { AiProvider } from './AiProvider';
import type { Fact, SuitoAi } from './contract';
import { createFakeSuitoAi } from './fake';
import { useAiFeatures } from './useAiFeatures';

const FACTS: Fact[] = [
  { id: 'spend', label: 'spend', display: '¥12,400', value: 12400, tone: 'neutral' },
  { id: 'food', label: 'food', display: '+32%', value: 32, tone: 'watch' },
  { id: 'unused', label: 'unused', display: 'x', value: 0, tone: 'neutral' },
];

jest.mock('./facts', () => ({ buildFacts: jest.fn(() => FACTS) }));
jest.mock('./cite', () => ({
  factDisplays: (facts: { id: string; display: string }[]) =>
    Object.fromEntries(facts.map((f) => [f.id, f.display])),
  citedIds: (text: string) => [...text.matchAll(/\{f:([^}]+)\}/g)].map((m) => m[1]),
  // "BAD" stands in for a paragraph the real renderer rejects.
  renderCited: (text: string) => (text.includes('BAD') ? null : text),
}));

const today = { y: 2026, m: 9, day: 23 };

const septemberEntry = {
  id: 's1',
  timestamp: '2026-09-10T12:00:00.000Z',
  y: 2026,
  m: 8,
  day: 10,
  type: 'expense' as const,
  amount: 500,
  category: 'Food',
  note: '',
  repeat: 'never' as const,
};

function setup(ai: SuitoAi, initial: Partial<AppState> = {}, active = true) {
  let state: AppState = { ...DEFAULT_STATE, entries: [septemberEntry], ...initial };
  const update = jest.fn((patch: Partial<AppState>) => {
    state = { ...state, ...patch };
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AiProvider ai={ai}>{children}</AiProvider>
  );
  const hook = renderHook(
    ({ s, on }: { s: AppState; on: boolean }) =>
      useAiFeatures({ state: s, update, today, locale: 'en', active: on }),
    { wrapper, initialProps: { s: state, on: active } },
  );
  return {
    update,
    get state() {
      return state;
    },
    rerender: (on = active) => hook.rerender({ s: state, on }),
    result: hook.result,
  };
}

describe('useAiFeatures', () => {
  it('writes last month’s letter once, freezing only the cited facts', async () => {
    const fake = createFakeSuitoAi();
    const writeLetter = jest.spyOn(fake, 'writeLetter');
    const t = setup(fake);
    await waitFor(() => expect(t.state.ai.letters['2026-09']).toBeDefined());
    const letter = t.state.ai.letters['2026-09'];
    expect(letter.paragraphs).toHaveLength(2);
    expect(letter.facts).toEqual({ spend: '¥12,400', food: '+32%' });
    expect(letter.dismissed).toBe(false);

    // Re-render with the saved letter: never rewritten.
    t.rerender();
    t.rerender(false);
    t.rerender(true);
    await act(async () => {});
    expect(writeLetter).toHaveBeenCalledTimes(1);
  });

  it('does not write a letter for a month with no entries', async () => {
    const fake = createFakeSuitoAi();
    const writeLetter = jest.spyOn(fake, 'writeLetter');
    const t = setup(fake, { entries: [] });
    await waitFor(() => expect(t.state.ai.nudge).not.toBeNull());
    expect(writeLetter).not.toHaveBeenCalled();
    expect(t.state.ai.letters).toEqual({});
  });

  it('drops paragraphs that fail to render and saves nothing if none survive', async () => {
    const fake = createFakeSuitoAi();
    fake.writeLetter = jest.fn(async () => ({ paragraphs: ['ok {f:spend}', 'BAD {f:food}'] }));
    const t = setup(fake);
    await waitFor(() => expect(t.state.ai.letters['2026-09']).toBeDefined());
    expect(t.state.ai.letters['2026-09'].paragraphs).toEqual(['ok {f:spend}']);
    expect(t.state.ai.letters['2026-09'].facts).toEqual({ spend: '¥12,400' });

    const fake2 = createFakeSuitoAi();
    fake2.writeLetter = jest.fn(async () => ({ paragraphs: ['BAD'] }));
    const t2 = setup(fake2);
    await waitFor(() => expect(t2.state.ai.nudge).not.toBeNull());
    expect(t2.state.ai.letters).toEqual({});
  });

  it('picks a nudge at most once per day and keeps the letter it raced with', async () => {
    const fake = createFakeSuitoAi();
    const pickNudge = jest.spyOn(fake, 'pickNudge');
    const t = setup(fake);
    await waitFor(() => expect(t.state.ai.nudge).not.toBeNull());
    expect(t.state.ai.nudge).toEqual({
      date: '2026-10-23',
      text: 'Worth a look: {f:food}.',
      facts: { food: '+32%' },
      dismissed: false,
    });
    // Both writes landed: the nudge did not clobber the letter.
    expect(t.state.ai.letters['2026-09']).toBeDefined();

    t.rerender(false);
    t.rerender(true);
    await act(async () => {});
    expect(pickNudge).toHaveBeenCalledTimes(1);
  });

  it('saves a null nudge when the model says nothing or its text fails to render', async () => {
    const fake = createFakeSuitoAi();
    fake.pickNudge = jest.fn(async () => ({ text: 'BAD {f:food}' }));
    const t = setup(fake, { entries: [] });
    await waitFor(() => expect(t.state.ai.nudge).not.toBeNull());
    expect(t.state.ai.nudge).toMatchObject({ date: '2026-10-23', text: null, facts: {} });
  });

  it('does nothing when the on-device model is unavailable, inactive, or switched off', async () => {
    const off = createFakeSuitoAi({ availability: { onDevice: 'unsupported', system: 'available' } });
    const spy = jest.spyOn(off, 'writeLetter');
    const t = setup(off);
    await act(async () => {});
    expect(spy).not.toHaveBeenCalled();
    expect(t.update).not.toHaveBeenCalled();

    const fake = createFakeSuitoAi();
    const spy2 = jest.spyOn(fake, 'pickNudge');
    setup(fake, {}, false);
    setup(fake, { ai: { ...DEFAULT_STATE.ai, nudgesEnabled: false } });
    await act(async () => {});
    expect(spy2).not.toHaveBeenCalled();
  });

  it('updateAi chains on the latest write, not a stale render', async () => {
    const t = setup(createFakeSuitoAi({ availability: { onDevice: 'disabled', system: 'available' } }));
    await act(async () => {});
    act(() => {
      t.result.current.updateAi((ai) => ({ ...ai, nudgesEnabled: false }));
      t.result.current.updateAi((ai) => ({ ...ai, spotlightEnabled: false }));
    });
    expect(t.state.ai.nudgesEnabled).toBe(false);
    expect(t.state.ai.spotlightEnabled).toBe(false);
  });
});
