import { legacyCategoryId } from '../domain/identity';

/** Stable, non-public identifiers shared by the app and its iOS extensions. */
export const QUICK_ENTRY_APP_GROUP = 'group.com.taigamura.kaji' as const;
export const QUICK_ENTRY_BUNDLE_IDENTIFIER = 'com.taigamura.kaji' as const;
export const QUICK_ENTRY_URL_SCHEME = 'kaji-quick-entry' as const;
export const QUICK_ENTRY_INBOX_DIRECTORY = 'quick-entry-inbox' as const;
export const QUICK_ENTRY_QUARANTINE_DIRECTORY = 'quick-entry-quarantine' as const;
export const QUICK_ENTRY_DEEP_LINK_QUEUE_KEY = 'kaji:quick-entry:v1:deep-links' as const;
export const QUICK_ENTRY_SNAPSHOT_FILE = 'quick-entry-snapshot.json' as const;
export const QUICK_ENTRY_SNAPSHOT_MAX_BYTES = 24 * 1024;
export const QUICK_ENTRY_SNAPSHOT_MAX_STRING_LENGTH = 128;

function utf8ByteLength(value: string): number {
  return (encodeURIComponent(value).match(/%[0-9A-F]{2}|./g) ?? []).length;
}

export interface QuickEntrySnapshot {
  readonly version: 3;
  readonly categories: readonly { readonly id: string; readonly name: string }[];
  readonly currency: { readonly symbol: string; readonly code: string };
  readonly defaults: { readonly categoryId: string | null; readonly recentCategoryIds: readonly string[] };
  /** Read-only current-month payload for glanceable widget families. */
  readonly allowance: { readonly status: 'available' | 'no-budget' | 'overspent'; readonly amount: number | null };
}

export function isQuickEntrySnapshot(value: unknown): value is QuickEntrySnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<QuickEntrySnapshot>;
  const categories = snapshot.categories;
  const currency = snapshot.currency;
  const defaults = snapshot.defaults;
  const allowance = snapshot.allowance;
  if (!Array.isArray(categories) || !currency || !defaults || !allowance || !Array.isArray(defaults.recentCategoryIds)) return false;
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return false; }
  return utf8ByteLength(serialized) <= QUICK_ENTRY_SNAPSHOT_MAX_BYTES
    && snapshot.version === 3
    && categories.length > 0 && categories.length <= 100
    && categories.every((category) => Boolean(category) && typeof category.id === 'string' && category.id.length > 0 && category.id.length <= QUICK_ENTRY_SNAPSHOT_MAX_STRING_LENGTH && typeof category.name === 'string' && category.name.length > 0 && category.name.length <= QUICK_ENTRY_SNAPSHOT_MAX_STRING_LENGTH)
    && new Set(categories.map((category) => category.id)).size === categories.length
    && [['¥', 'JPY'], ['$', 'USD'], ['€', 'EUR'], ['£', 'GBP']].some(([symbol, code]) => currency.symbol === symbol && currency.code === code)
    && (defaults.categoryId === null || (typeof defaults.categoryId === 'string' && categories.some((category) => category.id === defaults.categoryId)))
    && defaults.recentCategoryIds.length <= 3
    && new Set(defaults.recentCategoryIds).size === defaults.recentCategoryIds.length
    && defaults.recentCategoryIds.every((id) => typeof id === 'string' && categories.some((category) => category.id === id))
    && (allowance.status === 'available' || allowance.status === 'no-budget' || allowance.status === 'overspent')
    && (allowance.status !== 'available'
      ? allowance.amount === null
      : typeof allowance.amount === 'number' && Number.isSafeInteger(allowance.amount) && allowance.amount >= 0);
}

/** The extension gets a copy, never a writable handle to the ledger. */
export function makeQuickEntrySnapshot(
  categories: readonly string[],
  currency: { readonly symbol: string; readonly code: string },
  categoryIds: readonly string[] = [],
  recentCategoryIds?: readonly string[],
  allowance: QuickEntrySnapshot['allowance'] = { status: 'no-budget', amount: null },
): QuickEntrySnapshot {
  const categoryRecords = categories.map((name) => ({
    id: categoryIds[categories.indexOf(name)] ?? legacyCategoryId('expense', name),
    name,
  }));
  const ids = categoryRecords.map(({ id }) => id);
  return Object.freeze({
    version: 3,
    categories: Object.freeze(categoryRecords),
    currency: Object.freeze({ ...currency }),
    defaults: Object.freeze({
      categoryId: categoryRecords[0]?.id ?? null,
      recentCategoryIds: Object.freeze([...(recentCategoryIds?.length ? recentCategoryIds : ids)].filter((id) => categoryRecords.some((category) => category.id === id)).slice(0, 3)),
    }),
    allowance: Object.freeze({ ...allowance }),
  });
}
