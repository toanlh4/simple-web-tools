import { create } from 'zustand';
import { clearThumbs, deleteThumbs, loadThumb, loadThumbMeta, saveThumb, saveThumbMeta, type ThumbMeta } from './db';

const MAX_BYTES = 500 * 1024 * 1024;
const TRIM_TO_BYTES = 450 * 1024 * 1024;
const FLUSH_DELAY = 5000;

/** Total size of the thumbnails kept in IndexedDB, for display. */
export const useThumbCacheSize = create<{ bytes: number }>()(() => ({ bytes: 0 }));

let loading: Promise<Map<string, ThumbMeta>> | null = null;
const touched = new Map<string, ThumbMeta>();
let flushTimer = 0;

/** Sizes and last-use times live in memory; only the blobs are read per lookup. */
function loadMetas(): Promise<Map<string, ThumbMeta>> {
  loading ??= loadThumbMeta().then((list) => {
    const metas = new Map((list ?? []).map((m) => [m.key, m]));
    let bytes = 0;
    for (const m of metas.values()) bytes += m.bytes;
    useThumbCacheSize.setState({ bytes });
    return metas;
  });
  return loading;
}

export async function initThumbCache(): Promise<void> {
  await loadMetas();
}

function touch(meta: ThumbMeta): void {
  meta.used = Date.now();
  touched.set(meta.key, meta);
  flushTimer ||= window.setTimeout(() => {
    flushTimer = 0;
    const list = [...touched.values()];
    touched.clear();
    saveThumbMeta(list).catch(() => undefined);
  }, FLUSH_DELAY);
}

/** Removes the least recently used thumbnails until the total is at most `target`. */
async function trim(metas: Map<string, ThumbMeta>, target: number): Promise<void> {
  let { bytes } = useThumbCacheSize.getState();
  const removed: string[] = [];
  for (const meta of [...metas.values()].sort((a, b) => a.used - b.used)) {
    if (bytes <= target) break;
    bytes -= meta.bytes;
    metas.delete(meta.key);
    touched.delete(meta.key);
    removed.push(meta.key);
  }
  useThumbCacheSize.setState({ bytes });
  await deleteThumbs(removed);
}

/** Pass `file` to accept only a thumbnail made from this exact version; null accepts any. */
export async function getCachedThumb(key: string, file: File | null): Promise<Blob | null> {
  const meta = (await loadMetas()).get(key);
  if (!meta || (file && (meta.size !== file.size || meta.modified !== file.lastModified))) return null;
  const blob = await loadThumb(key);
  if (!blob) return null;
  if (file) touch(meta);
  return blob;
}

export async function putCachedThumb(key: string, file: File, blob: Blob): Promise<void> {
  const metas = await loadMetas();
  const meta: ThumbMeta = { key, size: file.size, modified: file.lastModified, bytes: blob.size, used: Date.now() };
  try {
    await saveThumb(meta, blob);
    const previous = metas.get(key)?.bytes ?? 0;
    metas.set(key, meta);
    const bytes = useThumbCacheSize.getState().bytes + meta.bytes - previous;
    useThumbCacheSize.setState({ bytes });
    if (bytes > MAX_BYTES) await trim(metas, TRIM_TO_BYTES);
  } catch (err) {
    // The browser's quota is smaller than our limit: make room for later thumbnails.
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      await trim(metas, useThumbCacheSize.getState().bytes / 2).catch(() => undefined);
    }
  }
}

export async function clearThumbCache(): Promise<void> {
  await clearThumbs();
  (await loadMetas()).clear();
  touched.clear();
  useThumbCacheSize.setState({ bytes: 0 });
}
