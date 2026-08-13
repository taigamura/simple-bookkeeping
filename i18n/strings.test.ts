/**
 * Dictionary-completeness test (#29): `en` and `ja` must expose the exact
 * same key shape (recursively) so no screen falls back to a missing string.
 * Also covers `detectLanguage`'s device-locale → language mapping.
 */
import { detectLanguage } from './locale';
import { en, ja } from './strings';

/** Recursively collect `object.path.to.leaf` keys, treating functions and
 *  arrays as leaves (their contents are translated copy, not more structure). */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    typeof value === 'function'
  ) {
    return [prefix];
  }
  return Object.keys(value as Record<string, unknown>).flatMap((key) =>
    keyPaths((value as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key),
  );
}

describe('dictionary completeness', () => {
  it('en and ja expose the exact same set of string keys', () => {
    expect(keyPaths(ja).sort()).toEqual(keyPaths(en).sort());
  });

  it('every leaf in both dictionaries is a non-empty string, string array, or function', () => {
    for (const dict of [en, ja]) {
      for (const path of keyPaths(dict)) {
        const leaf = path.split('.').reduce<unknown>((v, k) => (v as any)[k], dict);
        const ok =
          (typeof leaf === 'string' && leaf.length > 0) ||
          typeof leaf === 'function' ||
          (Array.isArray(leaf) && leaf.every((s) => typeof s === 'string'));
        expect(ok).toBe(true);
      }
    }
  });
});

describe('detectLanguage', () => {
  it('defaults to en under the jest expo-localization mock (en-US)', () => {
    expect(detectLanguage()).toBe('en');
  });
});
