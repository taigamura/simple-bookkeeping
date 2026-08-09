import { validateQuickEntryCommand } from '../domain';
import type { Store } from '../store/store';
import { quickEntryBridge, type QuickEntryNativeBridge } from './quickEntryBridge';
import { makeQuickEntrySnapshot } from './quickEntryConfig';
import type { AppState } from '../store/schema';
import { categoryIdFor } from '../domain/identity';

/** Import native inbox/deep-link work only after the persisted store is ready. */
export async function reconcileNativeQuickEntries(
  store: Store,
  bridge: QuickEntryNativeBridge | null = quickEntryBridge,
): Promise<void> {
  if (!bridge) return;

  const files = await bridge.listInboxAsync();
  for (const file of files) {
    if (file.contents === null) {
      await bridge.quarantineInboxFileAsync(file.name);
      continue;
    }
    try {
      const command: unknown = JSON.parse(file.contents);
      if (validateQuickEntryCommand(command)) {
        await bridge.quarantineInboxFileAsync(file.name);
      } else {
        await store.queueQuickEntryCommand(command);
        await bridge.acknowledgeInboxFileAsync(file.name);
      }
    } catch {
      await bridge.quarantineInboxFileAsync(file.name);
    }
  }

  for (const item of await bridge.peekDeepLinksAsync()) {
    try {
      const parsed = new URL(item.url);
      if (parsed.protocol !== 'kaji-quick-entry:') throw new Error('Invalid deep link');
      // Public URLs are navigation/draft requests only. They never enqueue a
      // durable expense command without an explicit user Save action.
      await bridge.acknowledgeDeepLinkAsync(item.id);
    } catch {
      // Leave malformed links pending for diagnostics/retry; never ingest them.
    }
  }
}

export async function publishQuickEntrySnapshot(state: AppState): Promise<void> {
  if (!quickEntryBridge) return;
  const categoryIds = state.expCats.map((name) => categoryIdFor(name, 'expense', state.household.categories));
  await quickEntryBridge.writeSnapshotAsync(JSON.stringify(makeQuickEntrySnapshot(
    state.expCats,
    state.currency,
    categoryIds,
    state.device.expenseCategoryOrder.length ? state.device.expenseCategoryOrder : categoryIds,
  )));
}
