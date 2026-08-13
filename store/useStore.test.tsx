import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createMemoryPersistence } from './persistence';
import { DEFAULT_STATE } from './schema';
import { createStore } from './store';
import { useStore } from './useStore';

describe('useStore persistence notices', () => {
  it('reports a save failure instead of silently claiming durability', async () => {
    const store = createStore({
      ...createMemoryPersistence(),
      write: async () => {
        throw new Error('disk full');
      },
    });

    const { result } = renderHook(() => useStore(store));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.update({ theme: 'light' });
    });

    await waitFor(() => expect(result.current.persistenceNotice).toBe('save-failed'));
    expect(result.current.state).toEqual({ ...DEFAULT_STATE, theme: 'light' });
  });
});
