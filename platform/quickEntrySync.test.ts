import { createStore } from '../store/store';
import { createMemoryPersistence } from '../store/persistence';
import { DEFAULT_STATE } from '../store/schema';
import { reconcileNativeQuickEntries } from './quickEntrySync';
import type { QuickEntryNativeBridge } from './quickEntryBridge';

const command = JSON.stringify({
  version: 1, source: 'widget', id: 'coffee', timestamp: '2026-08-10T00:00:00.000Z',
  amount: 500, category: 'Food', note: 'Coffee', date: { y: 2026, m: 7, day: 10 },
});

function bridge(files: readonly { name: string; contents: string | null }[]): QuickEntryNativeBridge & { acknowledged: string[]; deepLinkAcks: string[] } {
  const acknowledged: string[] = [];
  const deepLinkAcks: string[] = [];
  return {
    acknowledged, deepLinkAcks,
    listInboxAsync: async () => files,
    acknowledgeInboxFileAsync: async (name) => { acknowledged.push(name); },
    quarantineInboxFileAsync: async (name) => { acknowledged.push(`quarantine:${name}`); },
    enqueueDeepLinkAsync: async () => {},
    peekDeepLinksAsync: async () => [{ id: 'link-1', url: `kaji-quick-entry://new?command=${encodeURIComponent(command)}` }],
    acknowledgeDeepLinkAsync: async (id) => { deepLinkAcks.push(id); },
    writeCommandFileAsync: async () => {},
    writeSnapshotAsync: async () => {},
  };
}

describe('native quick-entry reconciliation seam', () => {
  it('queues before acknowledging an inbox file and never ingests URL commands', async () => {
    const persistence = createMemoryPersistence();
    const store = createStore(persistence);
    const native = bridge([{ name: 'command.json', contents: command }]);

    await reconcileNativeQuickEntries(store, native);
    const result = await store.reconcileQuickEntryCommands(DEFAULT_STATE);

    expect(result.state.entries).toHaveLength(1);
    expect(native.acknowledged).toEqual(['command.json']);
    expect(native.deepLinkAcks).toEqual(['link-1']);
    expect(await persistence.readQuickEntryQueue!()).toBe('[]');
  });

  it('quarantines a partial native file while keeping it visible to operators', async () => {
    const native = bridge([{ name: 'partial.json', contents: null }]);
    await reconcileNativeQuickEntries(createStore(createMemoryPersistence()), native);
    expect(native.acknowledged).toEqual(['quarantine:partial.json']);
  });
});
