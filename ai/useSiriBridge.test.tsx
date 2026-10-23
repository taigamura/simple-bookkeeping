import { act, renderHook } from '@testing-library/react-native';
import { AppState as RNAppState, type AppStateStatus } from 'react-native';

import type { Transaction } from '../domain';
import { DEFAULT_STATE, type AppState } from '../store/schema';
import { UNAVAILABLE_AI, type InboxEntry, type SiriSnapshot, type SuitoAi } from './contract';
import { useSiriBridge } from './useSiriBridge';

const TODAY = { y: 2026, m: 9, day: 15 };

const existing: Transaction = {
  id: 'e1',
  timestamp: '2026-10-01T00:00:00.000Z',
  y: 2026,
  m: 9,
  day: 1,
  type: 'expense',
  amount: 100,
  category: 'Food',
  note: '',
  repeat: 'never',
};

const inboxItem = (over: Partial<InboxEntry> = {}): InboxEntry => ({
  id: 'u1',
  createdAt: '2026-10-15T00:00:00.000Z',
  date: '2026-10-14',
  type: 'expense',
  amount: 850,
  category: 'Food',
  note: 'ランチ',
  ...over,
});

function fakeAi(system: 'available' | 'unsupported', inbox: InboxEntry[] = []) {
  let box = [...inbox];
  const calls = {
    snapshots: [] as SiriSnapshot[],
    cleared: [] as string[][],
    spotlight: [] as { enabled: boolean; ids: string[] }[],
    reads: 0,
  };
  const ai: SuitoAi = {
    ...UNAVAILABLE_AI,
    availability: async () => ({ onDevice: 'unsupported', system }),
    readSiriInbox: async () => {
      calls.reads += 1;
      return box;
    },
    clearSiriInbox: async (ids) => {
      calls.cleared.push(ids);
      box = box.filter((i) => !ids.includes(i.id));
    },
    writeSiriSnapshot: async (s) => {
      calls.snapshots.push(s);
    },
    setSpotlight: async (req) => {
      calls.spotlight.push({ enabled: req.enabled, ids: req.entries.map((e) => e.id) });
    },
  };
  return { ai, calls, push: (i: InboxEntry) => box.push(i) };
}

/** A tiny store: the hook gets `update`, and re-renders with the new state. */
function setup(ai: SuitoAi, initial: Partial<AppState> = {}, ready = true) {
  let state: AppState = { ...DEFAULT_STATE, entries: [existing], ...initial };
  const updates: Partial<AppState>[] = [];
  const update = (patch: Partial<AppState>) => {
    updates.push(patch);
    state = { ...state, ...patch };
    view.rerender({ state, ready });
  };
  const view = renderHook(
    (props: { state: AppState; ready: boolean }) =>
      useSiriBridge({ ai, state: props.state, ready: props.ready, update, locale: 'ja', today: TODAY }),
    { initialProps: { state, ready } },
  );
  return {
    view,
    updates,
    getState: () => state,
    setState: (patch: Partial<AppState>) => {
      state = { ...state, ...patch };
      view.rerender({ state, ready });
    },
  };
}

let appStateListener: ((s: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  appStateListener = null;
  jest.spyOn(RNAppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (s: AppStateStatus) => void;
    return { remove: () => { appStateListener = null; } } as never;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Let pending promises (availability, inbox read) settle. */
const flush = async () => {
  for (let i = 0; i < 10; i += 1) await act(async () => { await Promise.resolve(); });
};

describe('useSiriBridge', () => {
  it('merges the inbox on ready, then clears what merged', async () => {
    const { ai, calls } = fakeAi('available', [inboxItem()]);
    const { updates, getState } = setup(ai);
    await flush();
    expect(updates).toHaveLength(1);
    expect(getState().entries.map((e) => e.id)).toEqual(['e1', 'siri-u1']);
    expect(calls.cleared).toEqual([['u1']]);
  });

  it('fills an empty category with the first expense / income category', async () => {
    const { ai } = fakeAi('available', [
      inboxItem({ id: 'x', category: '' }),
      inboxItem({ id: 'y', category: '', type: 'income' }),
    ]);
    const { getState } = setup(ai, { expCats: ['食費', '交通'], incCats: ['給料'] });
    await flush();
    const byId = Object.fromEntries(getState().entries.map((e) => [e.id, e.category]));
    expect(byId['siri-x']).toBe('食費');
    expect(byId['siri-y']).toBe('給料');
  });

  it('does not update when the inbox only holds already-merged items, but still clears them', async () => {
    const { ai, calls } = fakeAi('available', [inboxItem()]);
    const { updates } = setup(ai, {
      entries: [existing, { ...existing, id: 'siri-u1' }],
    });
    await flush();
    expect(updates).toHaveLength(0);
    expect(calls.cleared).toEqual([['u1']]);
  });

  it('merges again when the app comes back to the foreground', async () => {
    const { ai, push } = fakeAi('available');
    const { getState } = setup(ai);
    await flush();
    expect(getState().entries).toHaveLength(1);
    push(inboxItem({ id: 'later' }));
    act(() => appStateListener?.('active'));
    await flush();
    expect(getState().entries.map((e) => e.id)).toContain('siri-later');
  });

  it('waits for ready', async () => {
    const { ai, calls } = fakeAi('available', [inboxItem()]);
    setup(ai, {}, false);
    await flush();
    act(() => jest.advanceTimersByTime(1000));
    await flush();
    expect(calls.reads).toBe(0);
    expect(calls.snapshots).toHaveLength(0);
    expect(calls.spotlight).toHaveLength(0);
  });

  it('writes a debounced snapshot after state changes', async () => {
    const { ai, calls } = fakeAi('available');
    const { setState } = setup(ai);
    await flush();
    act(() => jest.advanceTimersByTime(500));
    await flush();
    expect(calls.snapshots).toHaveLength(1);
    expect(calls.snapshots[0].months['2026-10'].expense).toBe(100);

    setState({ entries: [existing, { ...existing, id: 'e2', amount: 50 }] });
    act(() => jest.advanceTimersByTime(200));
    setState({ entries: [existing, { ...existing, id: 'e2', amount: 70 }] });
    act(() => jest.advanceTimersByTime(499));
    await flush();
    expect(calls.snapshots).toHaveLength(1);
    act(() => jest.advanceTimersByTime(1));
    await flush();
    expect(calls.snapshots).toHaveLength(2);
    expect(calls.snapshots[1].months['2026-10'].expense).toBe(170);
  });

  it('sets Spotlight with concrete entries only when entries or the switch change', async () => {
    const { ai, calls } = fakeAi('available');
    const { setState, getState } = setup(ai, {
      recurrenceRules: [
        {
          id: 'rent',
          timestamp: '2026-01-01T00:00:00.000Z',
          start: { y: 2026, m: 0, day: 25 },
          anchorDay: 25,
          type: 'expense',
          amount: 80000,
          category: 'Bills',
          note: '',
          repeat: 'monthly',
          weekendShift: 'off',
          exceptions: [],
        },
      ],
    });
    await flush();
    expect(calls.spotlight).toEqual([{ enabled: true, ids: ['e1'] }]);

    setState({ theme: 'light' }); // unrelated change
    await flush();
    expect(calls.spotlight).toHaveLength(1);

    setState({ ai: { ...getState().ai, spotlightEnabled: false } });
    await flush();
    expect(calls.spotlight[1]).toEqual({ enabled: false, ids: ['e1'] });
  });

  it('does nothing when the system integration is unavailable', async () => {
    const { ai, calls } = fakeAi('unsupported', [inboxItem()]);
    const { updates } = setup(ai);
    await flush();
    act(() => jest.advanceTimersByTime(1000));
    await flush();
    expect(calls.reads).toBe(0);
    expect(updates).toHaveLength(0);
    expect(calls.snapshots).toHaveLength(0);
    expect(calls.spotlight).toHaveLength(0);
  });

  it('swallows errors from the native side', async () => {
    const boom = async () => {
      throw new Error('native');
    };
    const ai: SuitoAi = {
      ...UNAVAILABLE_AI,
      availability: async () => ({ onDevice: 'unsupported', system: 'available' }),
      readSiriInbox: boom,
      writeSiriSnapshot: boom,
      setSpotlight: boom,
    };
    const { updates } = setup(ai);
    await flush();
    act(() => jest.advanceTimersByTime(1000));
    await flush();
    act(() => appStateListener?.('active'));
    await flush();
    expect(updates).toHaveLength(0);
  });

  it('swallows a throwing availability check', async () => {
    const ai: SuitoAi = { ...UNAVAILABLE_AI, availability: async () => { throw new Error('x'); } };
    setup(ai);
    await flush();
    act(() => jest.advanceTimersByTime(1000));
    await flush();
  });
});
