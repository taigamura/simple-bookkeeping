import { createStore } from '../store/store';
import { createMemoryPersistence } from '../store/persistence';
import { DEFAULT_STATE } from '../store/schema';
import { reconcileNativeQuickEntries } from './quickEntrySync';
import type { EntryDraft } from '../domain';
import type { QuickEntryNativeBridge } from './quickEntryBridge';

const command = JSON.stringify({
  version: 1, source: 'widget', id: 'coffee', timestamp: '2026-08-10T00:00:00.000Z',
  amount: 500, category: 'Food', note: 'Coffee', date: { y: 2026, m: 7, day: 10 },
});

function bridge(files: readonly { name: string; contents: string | null }[], links = [`kaji-quick-entry://new?amount=500&category=Food&date=2026-08-10`]): QuickEntryNativeBridge & { acknowledged: string[]; deepLinkAcks: string[]; deepLinkQuarantines: string[] } {
  const acknowledged: string[] = [];
  const deepLinkAcks: string[] = [];
  const deepLinkQuarantines: string[] = [];
  return {
    acknowledged, deepLinkAcks, deepLinkQuarantines,
    listInboxAsync: async () => files,
    acknowledgeInboxFileAsync: async (name) => { acknowledged.push(name); },
    quarantineInboxFileAsync: async (name) => { acknowledged.push(`quarantine:${name}`); },
    enqueueDeepLinkAsync: async () => {},
    peekDeepLinksAsync: async () => links.map((url, index) => ({ id: `link-${index + 1}`, url })),
    acknowledgeDeepLinkAsync: async (id) => { deepLinkAcks.push(id); },
    quarantineDeepLinkAsync: async (id) => { deepLinkQuarantines.push(id); },
    writeCommandFileAsync: async () => {},
    writeSnapshotAsync: async () => {},
  };
}

describe('native quick-entry reconciliation seam', () => {
  it('queues before acknowledging an inbox file and never ingests URL commands', async () => {
    const persistence = createMemoryPersistence();
    const store = createStore(persistence);
    const native = bridge([{ name: 'command.json', contents: command }]);

    const drafts: EntryDraft[] = [];
    await reconcileNativeQuickEntries(store, native, async (draft) => { drafts.push(draft); });
    const result = await store.reconcileQuickEntryCommands(DEFAULT_STATE);

    expect(result.state.entries).toHaveLength(1);
    expect(native.acknowledged).toEqual(['command.json']);
    expect(native.deepLinkAcks).toEqual(['link-1']);
    expect(drafts).toEqual([expect.objectContaining({ amountStr: '500', category: 'Food' })]);
    expect(await persistence.readQuickEntryQueue!()).toBe('[]');
  });

  it('quarantines a partial native file while keeping it visible to operators', async () => {
    const native = bridge([{ name: 'partial.json', contents: null }]);
    await reconcileNativeQuickEntries(createStore(createMemoryPersistence()), native);
    expect(native.acknowledged).toEqual(['quarantine:partial.json']);
  });

  it('keeps a valid URL queued when draft handoff fails, then acknowledges after retry', async () => {
    const native = bridge([]);
    await expect(reconcileNativeQuickEntries(createStore(createMemoryPersistence()), native, async () => {
      throw new Error('navigation not ready');
    })).rejects.toThrow('navigation not ready');
    expect(native.deepLinkAcks).toEqual([]);
    await reconcileNativeQuickEntries(createStore(createMemoryPersistence()), native, async () => {});
    expect(native.deepLinkAcks).toEqual(['link-1']);
  });

  it('processes different queued links in order and waits for each exact handoff before acking', async () => {
    const native = bridge([], [
      'kaji-quick-entry://new?amount=100&category=Food&date=2026-08-10',
      'kaji-quick-entry://new?amount=200&category=Rent&date=2026-08-11',
    ]);
    const drafts: EntryDraft[] = [];
    let releaseFirst!: () => void;
    const firstConsumed = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const run = reconcileNativeQuickEntries(createStore(createMemoryPersistence()), native, async (draft) => {
      drafts.push(draft);
      if (drafts.length === 1) await firstConsumed;
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(drafts.map((draft) => draft.category)).toEqual(['Food']);
    expect(native.deepLinkAcks).toEqual([]);
    releaseFirst();
    await run;

    expect(drafts.map((draft) => draft.category)).toEqual(['Food', 'Rent']);
    expect(native.deepLinkAcks).toEqual(['link-1', 'link-2']);
  });

  it('quarantines malformed URLs without touching the ledger', async () => {
    const native = bridge([], ['kaji-quick-entry://new?amount=0&category=Food&date=2026-08-10']);
    const store = createStore(createMemoryPersistence());
    await reconcileNativeQuickEntries(store, native, async () => { throw new Error('must not hand off'); });
    expect(native.deepLinkAcks).toEqual([]);
    expect(native.deepLinkQuarantines).toEqual(['link-1']);
    expect((await store.load()).entries).toEqual([]);
  });
});
