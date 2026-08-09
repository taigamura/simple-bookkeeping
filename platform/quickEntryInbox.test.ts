import { createQuickEntryInbox, type InboxFileSystem } from './quickEntryInbox';
import { isQuickEntrySnapshot, makeQuickEntrySnapshot } from './quickEntryConfig';

function memoryFiles(): InboxFileSystem & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    mkdir: async () => {},
    list: async (path) => [...files.keys()]
      .filter((file) => file.startsWith(`${path}/`))
      .map((file) => file.slice(path.length + 1)),
    read: async (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error('missing');
      return value;
    },
    write: async (path, contents) => { files.set(path, contents); },
    move: async (from, to) => {
      const value = files.get(from);
      if (value === undefined) throw new Error('missing');
      files.set(to, value);
      files.delete(from);
    },
    remove: async (path) => { files.delete(path); },
  };
}

describe('quick-entry App Group inbox', () => {
  it('publishes through a temporary file and exposes only the final file', async () => {
    const fs = memoryFiles();
    const inbox = createQuickEntryInbox(fs, '/group');
    await inbox.publish('widget-1.json', '{"version":1}');
    expect(fs.files.has('/group/quick-entry-inbox/.widget-1.json.tmp')).toBe(false);
    await expect(inbox.list()).resolves.toEqual([{ name: 'widget-1.json', contents: '{"version":1}' }]);
    await expect(inbox.publish('widget-1.json', 'replacement')).rejects.toThrow('already exists');
  });

  it('acknowledges and quarantines idempotently', async () => {
    const fs = memoryFiles();
    const inbox = createQuickEntryInbox(fs, '/group');
    await inbox.publish('bad.json', 'bad');
    await inbox.quarantine('bad.json');
    await inbox.quarantine('bad.json');
    expect(fs.files.has('/group/quick-entry-quarantine/bad.json')).toBe(true);
    await inbox.acknowledge('bad.json');
    await inbox.acknowledge('bad.json');
  });

  it('surfaces acknowledgement failures except for a missing source', async () => {
    const fs = memoryFiles();
    const inbox = createQuickEntryInbox(fs, '/group');
    await expect(inbox.acknowledge('missing.json')).resolves.toBeUndefined();
    fs.remove = async () => { throw new Error('permission denied'); };
    await expect(inbox.acknowledge('present.json')).rejects.toThrow('permission denied');
  });

  it('keeps unreadable inbox files observable instead of dropping them', async () => {
    const fs = memoryFiles();
    const inbox = createQuickEntryInbox(fs, '/group');
    await inbox.publish('partial.json', '{"version":');
    fs.read = async () => { throw new Error('invalid UTF-8'); };
    await expect(inbox.list()).resolves.toEqual([{ name: 'partial.json', contents: null }]);
  });

  it('freezes the extension snapshot so it cannot mutate app settings', () => {
    const snapshot = makeQuickEntrySnapshot(['Food'], { symbol: '¥', code: 'JPY' }, ['food-id'], ['food-id']);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.categories)).toBe(true);
    expect(Object.isFrozen(snapshot.currency)).toBe(true);
    expect(snapshot).toEqual({
      version: 2,
      categories: [{ id: 'food-id', name: 'Food' }],
      currency: { symbol: '¥', code: 'JPY' },
      defaults: { categoryId: 'food-id', recentCategoryIds: ['food-id'] },
    });
    expect(isQuickEntrySnapshot(snapshot)).toBe(true);
    expect(isQuickEntrySnapshot({ version: 1 })).toBe(false);
  });

  it('rejects snapshots with invalid currency, category identity, defaults, or bounds', () => {
    const good = makeQuickEntrySnapshot(['Food'], { symbol: '¥', code: 'JPY' }, ['food-id'], ['food-id']);
    expect(isQuickEntrySnapshot(good)).toBe(true);
    expect(isQuickEntrySnapshot({ ...good, currency: { symbol: 'x', code: 'JPY' } })).toBe(false);
    expect(isQuickEntrySnapshot({ ...good, categories: [{ id: '', name: 'Food' }] })).toBe(false);
    expect(isQuickEntrySnapshot({ ...good, categories: [{ id: 'same', name: 'A' }, { id: 'same', name: 'B' }] })).toBe(false);
    expect(isQuickEntrySnapshot({ ...good, defaults: { ...good.defaults, categoryId: 'missing' } })).toBe(false);
    expect(isQuickEntrySnapshot({ ...good, defaults: { ...good.defaults, recentCategoryIds: ['missing'] } })).toBe(false);
    expect(isQuickEntrySnapshot({ ...good, defaults: { ...good.defaults, recentCategoryIds: ['food-id', 'food-id'] } })).toBe(false);
    expect(isQuickEntrySnapshot({ ...good, categories: Array.from({ length: 101 }, (_, i) => ({ id: `id-${i}`, name: `C${i}` })) })).toBe(false);
  });
});
