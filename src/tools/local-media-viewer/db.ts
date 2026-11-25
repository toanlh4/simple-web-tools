import type { DirHandle } from './source';

// Storage is only a cache here, so callers treat any failure as a miss.

export interface SavedRoot {
  id: string;
  handle: DirHandle;
}

export interface SavedIndex {
  rootId: string;
  paths: string[];
  skipped: Record<string, number>;
}

export interface ThumbMeta {
  key: string;
  size: number;
  modified: number;
  bytes: number;
  used: number;
}

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('simple-web-tools-local-media-viewer', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('kv');
      request.result.createObjectStore('thumbs');
      request.result.createObjectStore('thumbMeta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

async function read<T>(store: string, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(store).objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}

/** Rejects when the transaction fails, e.g. because the quota is exceeded. */
async function write(stores: string[], run: (tx: IDBTransaction) => void): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    run(tx);
  });
}

export const loadRoot = () => read<SavedRoot | undefined>('kv', (s) => s.get('root'));
export const saveRoot = (root: SavedRoot) => write(['kv'], (tx) => tx.objectStore('kv').put(root, 'root'));

export const loadIndex = () => read<SavedIndex | undefined>('kv', (s) => s.get('index'));
export const saveIndex = (index: SavedIndex) => write(['kv'], (tx) => tx.objectStore('kv').put(index, 'index'));

export const loadThumbMeta = () => read<ThumbMeta[]>('thumbMeta', (s) => s.getAll());
export const loadThumb = (key: string) => read<Blob | undefined>('thumbs', (s) => s.get(key));

export const saveThumb = (meta: ThumbMeta, blob: Blob) =>
  write(['thumbs', 'thumbMeta'], (tx) => {
    tx.objectStore('thumbs').put(blob, meta.key);
    tx.objectStore('thumbMeta').put(meta);
  });

export const saveThumbMeta = (metas: ThumbMeta[]) =>
  write(['thumbMeta'], (tx) => metas.forEach((m) => tx.objectStore('thumbMeta').put(m)));

export const deleteThumbs = (keys: string[]) =>
  write(['thumbs', 'thumbMeta'], (tx) =>
    keys.forEach((key) => {
      tx.objectStore('thumbs').delete(key);
      tx.objectStore('thumbMeta').delete(key);
    }),
  );

export const clearThumbs = () =>
  write(['thumbs', 'thumbMeta'], (tx) => {
    tx.objectStore('thumbs').clear();
    tx.objectStore('thumbMeta').clear();
  });
