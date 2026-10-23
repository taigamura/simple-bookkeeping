import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('./withSuitoAppIntents.js');

const swift = (file: string) => fs.readFileSync(path.join(__dirname, 'app-intents', file), 'utf8');

/** Phrase literals in SuitoAppShortcuts.swift, in .strings key form. */
function basePhrases(): string[] {
  const src = swift('SuitoAppShortcuts.swift');
  const out: string[] = [];
  for (const block of src.match(/phrases: \[([\s\S]*?)\]/g) ?? []) {
    for (const m of block.matchAll(/^\s*"(.*)",?$/gm)) {
      out.push(m[1].replace(/\\\(\.applicationName\)/g, '${applicationName}').replace(/\\\(\\\.\$(\w+)\)/g, '${$1}'));
    }
  }
  return out;
}

describe('withSuitoAppIntents', () => {
  it('targets iOS 26', () => {
    expect(plugin.DEPLOYMENT_TARGET).toBe('26.0');
  });

  it('has exactly one Japanese phrase per English App Shortcut phrase', () => {
    const phrases = basePhrases();
    expect(phrases.length).toBeGreaterThan(5);
    expect(Object.keys(plugin.JA_APP_SHORTCUTS).sort()).toEqual([...phrases].sort());
  });

  it('keeps every parameter placeholder in the Japanese phrase', () => {
    for (const [en, ja] of Object.entries<string>(plugin.JA_APP_SHORTCUTS)) {
      const vars = (s: string) => (s.match(/\$\{\w+\}/g) ?? []).sort();
      expect(vars(ja)).toEqual(vars(en));
      expect(ja).toContain('${applicationName}');
    }
  });

  it('translates every intent title used in the Swift sources', () => {
    const src = ['SuitoIntents.swift', 'SuitoEntities.swift'].map(swift).join('\n');
    const titles = [
      ...src.matchAll(/(?:title|LocalizedStringResource|requestValueDialog|TypeDisplayRepresentation) ?[:=] "([^"\\]+)"/g),
    ].map((m) => m[1]);
    expect(titles.length).toBeGreaterThan(10);
    for (const t of titles) expect(plugin.JA_LOCALIZABLE).toHaveProperty([t]);
  });
});
