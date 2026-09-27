import * as fs from 'fs';
import * as path from 'path';
import { ObjectStorage, StoredObject, assertSafeKey } from './object-storage';

/**
 * Files on the container's own disk.
 *
 * Fine for development and for a host with a persistent volume mounted at
 * `root`. On Railway without a volume every deploy starts from an empty disk,
 * so uploads vanish — StorageModule warns about exactly that at startup.
 */
export class LocalDiskStorage implements ObjectStorage {
  readonly driver = 'local' as const;

  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertSafeKey(key);
    const absolute = path.resolve(this.root, key);
    // Belt and braces on top of assertSafeKey: the result must stay inside root.
    if (!absolute.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error(`Storage key escapes root: ${key}`);
    }
    return absolute;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const absolute = this.resolve(key);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, body);
  }

  async get(key: string): Promise<StoredObject | null> {
    const absolute = this.resolve(key);
    try {
      const stat = await fs.promises.stat(absolute);
      if (!stat.isFile()) return null;
      return { stream: fs.createReadStream(absolute), contentType: null, size: stat.size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }
}
