import { createQuickEntryInbox, type InboxFileSystem } from './quickEntryInbox';
import { makeQuickEntrySnapshot } from './quickEntryConfig';

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

  it('freezes the extension snapshot so it cannot mutate app settings', () => {
    const snapshot = makeQuickEntrySnapshot(['Food'], { symbol: '¥', code: 'JPY' });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.categories)).toBe(true);
    expect(Object.isFrozen(snapshot.currency)).toBe(true);
    expect(snapshot).toEqual({ version: 1, categories: ['Food'], currency: { symbol: '¥', code: 'JPY' } });
  });
});
