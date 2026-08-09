import { validateQuickEntryCommand } from '../domain';
import type { Store } from '../store/store';
import { quickEntryBridge } from './quickEntryBridge';
import { makeQuickEntrySnapshot } from './quickEntryConfig';
import type { AppState } from '../store/schema';

/** Import native inbox/deep-link work only after the persisted store is ready. */
export async function reconcileNativeQuickEntries(store: Store): Promise<void> {
  if (!quickEntryBridge) return;

  const files = await quickEntryBridge.listInboxAsync();
  for (const file of files) {
    try {
      const command: unknown = JSON.parse(file.contents);
      if (validateQuickEntryCommand(command)) {
        await quickEntryBridge.quarantineInboxFileAsync(file.name);
      } else {
        await store.queueQuickEntryCommand(command);
        await quickEntryBridge.acknowledgeInboxFileAsync(file.name);
      }
    } catch {
      await quickEntryBridge.quarantineInboxFileAsync(file.name);
    }
  }

  for (const url of await quickEntryBridge.drainDeepLinksAsync()) {
    try {
      const parsed = new URL(url);
      const raw = parsed.searchParams.get('command');
      if (!raw) continue;
      const command: unknown = JSON.parse(raw);
      if (!validateQuickEntryCommand(command)) await store.queueQuickEntryCommand(command);
    } catch {
      // Invalid deep links are dropped, never allowed to reach the ledger.
    }
  }
}

export async function publishQuickEntrySnapshot(state: AppState): Promise<void> {
  if (!quickEntryBridge) return;
  await quickEntryBridge.writeSnapshotAsync(JSON.stringify(makeQuickEntrySnapshot(
    state.expCats,
    state.currency,
  )));
}
