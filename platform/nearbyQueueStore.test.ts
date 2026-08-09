jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createNearbyQueueStore, nearbyQueueStorageKey } from './nearbyQueueStore';

describe('durable nearby queue store', () => {
  beforeEach(() => jest.clearAllMocks());

  it('restores queued operations and the replay fence on launch', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
      pending: [{ operationId: 'phone-a:1' }],
      seenMessageIds: ['message-1'],
      inFlight: null,
    }));
    const store = createNearbyQueueStore('home', 'phone-a');
    await expect(store.load()).resolves.toEqual({
      pending: [{ operationId: 'phone-a:1' }],
      seenMessageIds: ['message-1'],
      inFlight: null,
    });
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(nearbyQueueStorageKey('home', 'phone-a'));
  });

  it('rejects malformed persisted values without exposing secrets', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{broken');
    await expect(createNearbyQueueStore('home', 'phone-a').load()).resolves.toEqual({ pending: [], seenMessageIds: [], inFlight: null });
  });
});
