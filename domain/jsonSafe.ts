/**
 * Structural safety check for anything that will be serialized to, or was
 * parsed from, a user-visible file. Rejects cycles, non-finite numbers, and
 * prototype-polluting keys before the value is validated field by field.
 */
export function isJsonSafe(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonSafe(item, seen))
    : Object.keys(value).every((key) => key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
      && isJsonSafe((value as Record<string, unknown>)[key], seen));
  seen.delete(value);
  return valid;
}
