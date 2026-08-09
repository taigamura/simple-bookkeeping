import { legacyCategoryId } from '../domain/identity';

/** Stable, non-public identifiers shared by the app and its iOS extensions. */
export const QUICK_ENTRY_APP_GROUP = 'group.com.taigamura.kaji' as const;
export const QUICK_ENTRY_BUNDLE_IDENTIFIER = 'com.taigamura.kaji' as const;
export const QUICK_ENTRY_URL_SCHEME = 'kaji-quick-entry' as const;
export const QUICK_ENTRY_INBOX_DIRECTORY = 'quick-entry-inbox' as const;
export const QUICK_ENTRY_QUARANTINE_DIRECTORY = 'quick-entry-quarantine' as const;
export const QUICK_ENTRY_DEEP_LINK_QUEUE_KEY = 'kaji:quick-entry:v1:deep-links' as const;
export const QUICK_ENTRY_SNAPSHOT_FILE = 'quick-entry-snapshot.json' as const;

export interface QuickEntrySnapshot {
  readonly version: 2;
  readonly categories: readonly { readonly id: string; readonly name: string }[];
  readonly currency: { readonly symbol: string; readonly code: string };
  readonly defaults: { readonly categoryId: string | null; readonly recentCategoryIds: readonly string[] };
}

export function isQuickEntrySnapshot(value: unknown): value is QuickEntrySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<QuickEntrySnapshot>;
  return snapshot.version === 2
    && Array.isArray(snapshot.categories)
    && snapshot.categories.every((category) => Boolean(category) && typeof category.id === 'string' && typeof category.name === 'string')
    && Boolean(snapshot.currency && typeof snapshot.currency.symbol === 'string' && typeof snapshot.currency.code === 'string')
    && Boolean(snapshot.defaults && (snapshot.defaults.categoryId === null || typeof snapshot.defaults.categoryId === 'string'))
    && Array.isArray(snapshot.defaults?.recentCategoryIds)
    && snapshot.defaults.recentCategoryIds.every((id) => typeof id === 'string');
}

/** The extension gets a copy, never a writable handle to the ledger. */
export function makeQuickEntrySnapshot(
  categories: readonly string[],
  currency: { readonly symbol: string; readonly code: string },
  categoryIds: readonly string[] = [],
  recentCategoryIds?: readonly string[],
): QuickEntrySnapshot {
  const categoryRecords = categories.map((name) => ({
    id: categoryIds[categories.indexOf(name)] ?? legacyCategoryId('expense', name),
    name,
  }));
  const ids = categoryRecords.map(({ id }) => id);
  return Object.freeze({
    version: 2,
    categories: Object.freeze(categoryRecords),
    currency: Object.freeze({ ...currency }),
    defaults: Object.freeze({
      categoryId: categoryRecords[0]?.id ?? null,
      recentCategoryIds: Object.freeze([...(recentCategoryIds?.length ? recentCategoryIds : ids)].filter((id) => categoryRecords.some((category) => category.id === id)).slice(0, 3)),
    }),
  });
}
