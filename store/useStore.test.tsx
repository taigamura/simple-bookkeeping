import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMemoryPersistence } from './persistence';
import { DEFAULT_STATE } from './schema';
import { createStore } from './store';
import { useStore } from './useStore';
import type { AppState } from './schema';

describe('useStore persistence notices', () => {
  it('reports quick-entry cache publication separately from a successful ledger save', async () => {
    const publisher = jest.fn(async (_state: AppState) => { throw new Error('shared container unavailable'); });
    const store = createStore(createMemoryPersistence());
    const { result } = renderHook(() => useStore(store, publisher));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() => expect(result.current.persistenceNotice).toBe('quick-entry-cache-failed'));
    let persisted = false;
    await act(async () => { persisted = await result.current.update({ theme: 'light' }); });
    expect(persisted).toBe(true);
    expect(result.current.persistenceNotice).toBe('quick-entry-cache-failed');
    expect(publisher).toHaveBeenCalled();
  });
  it('reports a save failure instead of silently claiming durability', async () => {
    const store = createStore({
      ...createMemoryPersistence(),
      write: async () => {
        throw new Error('disk full');
      },
    });

    const { result } = renderHook(() => useStore(store));
    await waitFor(() => expect(result.current.ready).toBe(true));

    let persisted = true;
    await act(async () => {
      persisted = await result.current.update({ theme: 'light' });
    });

    expect(persisted).toBe(false);
    await waitFor(() => expect(result.current.persistenceNotice).toBe('save-failed'));
    expect(result.current.state).toEqual({ ...DEFAULT_STATE, theme: 'light' });
  });

  it('reconciles against the latest state and publishes the reconciled state to later updates', async () => {
    const persistence = createMemoryPersistence();
    const store = createStore(persistence);
    const { result } = renderHook(() => useStore(store));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await store.queueQuickEntryCommand({
      version: 1, source: 'widget', id: 'latest', timestamp: '2026-08-10T00:00:00.000Z',
      amount: 500, category: 'Food', note: 'Coffee', date: { y: 2026, m: 7, day: 10 },
    }); });

    await act(async () => { await result.current.update({ theme: 'light' }); });
    await act(async () => { await result.current.reconcileQuickEntries(); });
    await act(async () => { await result.current.update({ budgetMode: 'total' }); });

    expect(result.current.state.entries).toHaveLength(1);
    expect(result.current.state.theme).toBe('light');
    expect(result.current.state.budgetMode).toBe('total');
  });

  it('serializes the canonical device slice after consecutive top-level updates and reloads it', async () => {
    const persistence = createMemoryPersistence();
    const store = createStore(persistence);
    const { result } = renderHook(() => useStore(store, async () => {}));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.update({ theme: 'dark', budgetMode: 'total' }); });
    await act(async () => { await result.current.update({ theme: 'light', totalBudget: 90000 }); });
    expect(result.current.state.device).toMatchObject({ theme: 'light', budgetMode: 'total', totalBudget: 90000 });
    const reloaded = await createStore(persistence).load();
    expect(reloaded).toMatchObject({ theme: 'light', budgetMode: 'total', totalBudget: 90000 });
    expect(reloaded.device).toMatchObject({ theme: 'light', budgetMode: 'total', totalBudget: 90000 });
  });
});
