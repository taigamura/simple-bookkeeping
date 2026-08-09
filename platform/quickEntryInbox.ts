import {
  QUICK_ENTRY_INBOX_DIRECTORY,
  QUICK_ENTRY_QUARANTINE_DIRECTORY,
} from './quickEntryConfig';

export interface InboxFile {
  readonly name: string;
  readonly contents: string | null;
}

export interface InboxFileSystem {
  mkdir(path: string): Promise<void>;
  list(path: string): Promise<readonly string[]>;
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export interface QuickEntryInbox {
  publish(fileName: string, contents: string): Promise<void>;
  list(): Promise<InboxFile[]>;
  acknowledge(fileName: string): Promise<void>;
  quarantine(fileName: string): Promise<void>;
}

const safeName = (name: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\.json$/.test(name);

/**
 * App Group inbox contract. A file becomes visible only after the temporary
 * file has been moved into place. The app never writes the AsyncStorage blob
 * while reading or acknowledging an inbox file.
 */
export function createQuickEntryInbox(fs: InboxFileSystem, root: string): QuickEntryInbox {
  const inbox = `${root}/${QUICK_ENTRY_INBOX_DIRECTORY}`;
  const quarantineDir = `${root}/${QUICK_ENTRY_QUARANTINE_DIRECTORY}`;
  const pathFor = (dir: string, name: string) => `${dir}/${name}`;

  async function ensure() {
    await fs.mkdir(inbox);
    await fs.mkdir(quarantineDir);
  }

  return {
    async publish(fileName, contents) {
      if (!safeName(fileName)) throw new Error('Invalid quick-entry file name');
      await ensure();
      if ((await fs.list(inbox)).includes(fileName)) throw new Error('Quick-entry file already exists');
      const temporary = pathFor(inbox, `.${fileName}.tmp`);
      await fs.write(temporary, contents);
      await fs.move(temporary, pathFor(inbox, fileName));
    },
    async list() {
      await ensure();
      const names = (await fs.list(inbox)).filter(safeName).sort();
      const files: InboxFile[] = [];
      for (const name of names) {
        try { files.push({ name, contents: await fs.read(pathFor(inbox, name)) }); }
        catch { files.push({ name, contents: null }); }
      }
      return files;
    },
    async acknowledge(fileName) {
      if (!safeName(fileName)) return;
      try { await fs.remove(pathFor(inbox, fileName)); }
      catch (error) {
        if (error instanceof Error && /missing|not found|no such file/i.test(error.message)) return;
        throw error;
      }
    },
    async quarantine(fileName) {
      if (!safeName(fileName)) return;
      await ensure();
      const source = pathFor(inbox, fileName);
      try {
        await fs.move(source, pathFor(quarantineDir, fileName));
      } catch {
        // Idempotent: a retry may already have moved or removed the file.
      }
    },
  };
}
