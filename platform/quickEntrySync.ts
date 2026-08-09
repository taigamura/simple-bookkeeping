import { validateQuickEntryCommand } from '../domain';
import type { Store } from '../store/store';
import { quickEntryBridge, type QuickEntryNativeBridge } from './quickEntryBridge';
import { makeQuickEntrySnapshot } from './quickEntryConfig';
import type { AppState } from '../store/schema';
import { categoryIdFor } from '../domain/identity';
import { parseQuickEntryUrl } from './quickEntryLinks';
import type { EntryDraft } from '../domain';

/** Import native inbox/deep-link work only after the persisted store is ready. */
export async function reconcileNativeQuickEntries(
  store: Store,
  bridge: QuickEntryNativeBridge | null = quickEntryBridge,
  handoffDraft?: (draft: EntryDraft) => Promise<void> | void,
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
    const draft = parseQuickEntryUrl(item.url);
    if (!draft) {
      await bridge.quarantineDeepLinkAsync(item.id);
      continue;
    }
    if (!handoffDraft) continue;
    await handoffDraft(draft);
    await bridge.acknowledgeDeepLinkAsync(item.id);
  }
}

export async function publishQuickEntrySnapshot(state: AppState, bridge: QuickEntryNativeBridge | null = quickEntryBridge): Promise<void> {
  if (!bridge) return;
  const categoryIds = state.expCats.map((name) => categoryIdFor(name, 'expense', state.household.categories));
  await bridge.writeSnapshotAsync(JSON.stringify(makeQuickEntrySnapshot(
    state.expCats,
    state.currency,
    categoryIds,
    state.device.expenseCategoryOrder.length ? state.device.expenseCategoryOrder : categoryIds,
  )));
}
