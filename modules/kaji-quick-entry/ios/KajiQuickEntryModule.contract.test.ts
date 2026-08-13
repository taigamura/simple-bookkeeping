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

  it('bounds snapshot bytes and every persisted string before JSON parsing', () => {
    expect(source).toContain('maxSnapshotBytes');
    expect(source).toContain('maxSnapshotStringLength');
    expect(source).toContain('data.count <= maxSnapshotBytes');
    expect(source).toContain('$0.count <= maxSnapshotStringLength');
  });

  it('registers a private JP/EN App Intent that writes an atomic reconciled command', () => {
    expect(source).toContain('import AppIntents');
    expect(source).toContain('struct LogExpenseIntent: AppIntent');
    expect(source).toContain('struct KajiAppShortcuts: AppShortcutsProvider');
    expect(source).toContain('struct ShortcutCategoryQuery: EntityStringQuery');
    expect(source).toContain('"Log an expense in \\(.applicationName)"');
    expect(source).toContain('支出を記録');
    expect(source).toContain('static var openAppWhenRun = false');
    expect(source).toContain('"source": "shortcut"');
    expect(source).toContain('withFractionalSeconds');
    expect(source).toContain('note.count <= 512');
    expect(source).toContain('try FileManager.default.moveItem(at: temporary, to: destination)');
  });
});
