/** Stable, non-public identifiers shared by the app and its iOS extensions. */
export const QUICK_ENTRY_APP_GROUP = 'group.com.taigamura.kaji' as const;
export const QUICK_ENTRY_BUNDLE_IDENTIFIER = 'com.taigamura.kaji' as const;
export const QUICK_ENTRY_URL_SCHEME = 'kaji-quick-entry' as const;
export const QUICK_ENTRY_INBOX_DIRECTORY = 'quick-entry-inbox' as const;
export const QUICK_ENTRY_QUARANTINE_DIRECTORY = 'quick-entry-quarantine' as const;
export const QUICK_ENTRY_DEEP_LINK_QUEUE_KEY = 'kaji:quick-entry:v1:deep-links' as const;
export const QUICK_ENTRY_SNAPSHOT_FILE = 'quick-entry-snapshot.json' as const;

export interface QuickEntrySnapshot {
  readonly version: 1;
  readonly categories: readonly string[];
  readonly currency: { readonly symbol: string; readonly code: string };
}

/** The extension gets a copy, never a writable handle to the ledger. */
export function makeQuickEntrySnapshot(
  categories: readonly string[],
  currency: { readonly symbol: string; readonly code: string },
): QuickEntrySnapshot {
  return Object.freeze({
    version: 1,
    categories: Object.freeze([...categories]),
    currency: Object.freeze({ ...currency }),
  });
}
