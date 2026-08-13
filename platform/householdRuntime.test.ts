jest.mock('./nearbyNativeTransport', () => ({
  createNativeNearbyTransport: () => ({ start: jest.fn(), stop: jest.fn(), send: jest.fn() }),
  bindNearbySyncToForeground: jest.fn(() => () => {}),
}));
const mockNearbyQueueStore = {
  load: jest.fn(async () => ({ pending: [], seenMessageIds: [], inFlight: null })),
  save: jest.fn(async () => {}),
};
jest.mock('./nearbyQueueStore', () => ({
  createNearbyQueueStore: jest.fn(() => mockNearbyQueueStore),
}));
jest.mock('../domain/recoveryPack', () => ({
  ...jest.requireActual('../domain/recoveryPack'),
  restoreRecoveryPack: jest.fn(async (store) => {
    const checkpoint = await store.load();
    const staged = { ...checkpoint, appState: { ...checkpoint.appState, theme: 'dark' } };
    try {
      await store.save(staged);
    } catch {
      await store.save(checkpoint);
      throw new Error('restore-failed');
    }
    return staged;
  }),
}));

import type { Transaction } from '../domain';
import { DEFAULT_STATE } from '../store/schema';
import { HouseholdRuntime, type HouseholdRuntimeMetadata, type HouseholdRuntimeStorage } from './householdRuntime';

const entry: Transaction = {
  id: 'entry-1', y: 2026, m: 7, day: 12, type: 'expense', amount: 1200,
  category: 'Food', note: '', timestamp: '2026-08-12T00:00:00.000Z',
};

function memoryStorage(): HouseholdRuntimeStorage & { value: HouseholdRuntimeMetadata | null } {
  return {
    value: null,
    load: async function load() { return this.value; },
    save: async function save(value) { this.value = value; },
  };
}

describe('HouseholdRuntime', () => {
  beforeEach(() => {
    mockNearbyQueueStore.load.mockReset();
    mockNearbyQueueStore.load.mockResolvedValue({ pending: [], seenMessageIds: [], inFlight: null });
    mockNearbyQueueStore.save.mockReset();
    mockNearbyQueueStore.save.mockResolvedValue(undefined);
  });

  it('keeps the household key out of its persisted checkpoint and queues durable local ledger changes', async () => {
    const secrets = new Map<string, string>();
    const keychain = {
      get: async (_service: string, account: string) => secrets.get(account) ?? null,
      set: async (_service: string, account: string, secret: string) => { secrets.set(account, secret); },
      delete: async (_service: string, account: string) => { secrets.delete(account); },
    };
    const storage = memoryStorage();
    const runtime = new HouseholdRuntime({ keychain, storage, applyIncomingEntries: async () => true });

    await runtime.start([]);
    await runtime.observeEntries([entry]);

    expect(storage.value).toEqual(expect.objectContaining({
      deviceId: expect.any(String),
      pairingState: expect.objectContaining({ devices: [expect.any(Object)] }),
      syncState: expect.objectContaining({ entries: [entry] }),
    }));
    expect(JSON.stringify(storage.value)).not.toContain('householdKey');
    expect([...secrets.values()]).toHaveLength(1);
    expect(runtime.history).toEqual([expect.objectContaining({ transactionId: entry.id, change: 'added' })]);
  });

  it('commits the outbound outbox before advancing the local sync checkpoint', async () => {
    const secrets = new Map<string, string>();
    const keychain = {
      get: async (_service: string, account: string) => secrets.get(account) ?? null,
      set: async (_service: string, account: string, secret: string) => { secrets.set(account, secret); },
      delete: async (_service: string, account: string) => { secrets.delete(account); },
    };
    const storage = memoryStorage();
    const runtime = new HouseholdRuntime({ keychain, storage, applyIncomingEntries: async () => true });
    await runtime.start([]);
    let releaseSave!: () => void;
    const saveMayFinish = new Promise<void>((resolve) => { releaseSave = resolve; });
    let signalSaveStarted!: () => void;
    const saveStarted = new Promise<void>((resolve) => { signalSaveStarted = resolve; });
    mockNearbyQueueStore.save.mockImplementationOnce(async () => {
      signalSaveStarted();
      await saveMayFinish;
    });

    const observing = runtime.observeEntries([entry]);
    await saveStarted;
    expect(storage.value?.syncState.entries).toEqual([]);

    releaseSave();
    await observing;
    expect(storage.value?.syncState.entries).toEqual([entry]);
  });

  it('rolls the app state and household checkpoint back when recovery persistence fails', async () => {
    const secrets = new Map<string, string>();
    const keychain = {
      get: async (_service: string, account: string) => secrets.get(account) ?? null,
      set: async (_service: string, account: string, secret: string) => { secrets.set(account, secret); },
      delete: async (_service: string, account: string) => { secrets.delete(account); },
    };
    const storage = memoryStorage();
    const runtime = new HouseholdRuntime({ keychain, storage, applyIncomingEntries: async () => true });
    await runtime.start([]);
    const checkpoint = storage.value;
    const authenticator = { authenticate: async () => true };
    const savedThemes: string[] = [];
    let failNextCheckpoint = true;
    const originalSave = storage.save.bind(storage);
    storage.save = async (value) => {
      if (failNextCheckpoint) {
        failNextCheckpoint = false;
        throw new Error('checkpoint write failed');
      }
      await originalSave(value);
    };

    await expect(runtime.restoreRecovery(
      DEFAULT_STATE,
      'encrypted-pack',
      'correct horse battery',
      authenticator,
      async (state) => { savedThemes.push(state.theme); return true; },
    )).rejects.toThrow('restore-failed');

    expect(savedThemes).toEqual(['dark', DEFAULT_STATE.theme]);
    expect(storage.value).toEqual(checkpoint);
  });
});
