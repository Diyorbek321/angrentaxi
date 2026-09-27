import { Readable } from 'stream';

/**
 * Where uploaded files live, behind one small interface.
 *
 * Only two operations exist because only two are needed: KYC scans are
 * written once and read back through an authorizing endpoint. There is no
 * public URL, no listing and no delete — a file is referenced by the DB row
 * that points at it, and deleting identity documents is a retention policy
 * decision, not something an endpoint should do by accident.
 */
export interface ObjectStorage {
  /** Human-readable driver name for logs and the startup banner. */
  readonly driver: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Null when the object does not exist. Other failures throw. */
  get(key: string): Promise<StoredObject | null>;
}

export interface StoredObject {
  stream: Readable;
  contentType: string | null;
  size: number | null;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/**
 * Keys are built by our own code, never taken from a request, but they are
 * still checked: a key that could climb out of its prefix on disk
 * (`../`) or address a different bucket path is refused at the boundary.
 */
const SAFE_KEY = /^[a-z0-9-]+(\/[A-Za-z0-9._-]+)+$/;

export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
  }
}
