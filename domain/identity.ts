/** Stable identities used by the household-shareable ledger schema. */
import type { Transaction, TxType } from './types';

export interface CategoryEntity { id: string; label: string; type: TxType; }

/** A UUID from the platform CSPRNG, with a Web Crypto fallback. */
export function stableId(): string {
  const cryptoValue = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
  if (cryptoValue?.randomUUID) return cryptoValue.randomUUID();
  if (cryptoValue?.getRandomValues) {
    const bytes = cryptoValue.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('A cryptographically secure random source is required for stable IDs');
}

/** Deterministic identity for a category that existed before v2. */
export function legacyCategoryId(type: TxType, label: string): string {
  let hash = 2166136261;
  for (const char of `${type}\0${label}`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `legacy-${type}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function categoryEntities(expCats: string[], incCats: string[], existing: CategoryEntity[] = []): CategoryEntity[] {
  const make = (label: string, type: TxType): CategoryEntity => ({
    id: existing.find((item) => item.type === type && item.label === label)?.id ?? (existing.length > 0 ? stableId() : legacyCategoryId(type, label)),
    label,
    type,
  });
  return [...expCats.map((label) => make(label, 'expense')), ...incCats.map((label) => make(label, 'income'))];
}

export function categoryIdFor(category: string, type: TxType, categories: CategoryEntity[]): string {
  return categories.find((item) => item.type === type && item.label === category)?.id ?? legacyCategoryId(type, category);
}

export function withCategoryId(transaction: Transaction, categories: CategoryEntity[]): Transaction {
  return transaction.categoryId ? transaction : { ...transaction, categoryId: categoryIdFor(transaction.category, transaction.type, categories) };
}
