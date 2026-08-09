import fs from 'node:fs';
import path from 'node:path';

describe('shipped Swift bridge contracts', () => {
  const source = fs.readFileSync(path.join(__dirname, 'KajiQuickEntryModule.swift'), 'utf8');

  it('uses native-generated UUID filenames and exclusive atomic publication', () => {
    expect(source).toContain('UUID().uuidString');
    expect(source).toContain('withIntermediateDirectories: true');
    expect(source).toContain('replaceItemAt');
    expect(source).not.toContain('try? FileManager.default.moveItem(at: temporary');
  });

  it('does not delete unreadable files and does not swallow filesystem errors', () => {
    expect(source).toContain('quick-entry-quarantine');
    expect(source).toContain('String(contentsOf: url, encoding: .utf8)');
    expect(source).toContain('throw QuickEntryException');
    expect(source).not.toContain('compactMap { url in');
    expect(source).not.toContain('try? FileManager.default.removeItem');
  });

  it('peeks and acknowledges deep links individually', () => {
    expect(source).toContain('peekDeepLinksAsync');
    expect(source).toContain('acknowledgeDeepLinkAsync');
    expect(source).not.toContain('removeObject(forKey: self.deepLinks)');
  });

  it('returns null for unreadable files and preserves the bridge contract', () => {
    expect(source).toContain('[[String: Any]]');
    expect(source).toContain('NSNull()');
    expect(source).toContain('validSnapshot');
  });
});
