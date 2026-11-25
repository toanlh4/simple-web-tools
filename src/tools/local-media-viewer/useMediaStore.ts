import { create } from 'zustand';
import { loadIndex, loadRoot, saveIndex, saveRoot, type SavedIndex, type SavedRoot } from './db';
import { extensionOf, toMediaItem, type MediaItem } from './media';
import { createDirectorySource, createFileListSource, pickDirectory, type MediaSource } from './source';
import { initThumbCache } from './thumbCache';
import { forgetThumbs } from './thumbs';

interface MediaState {
  /** False until the saved folder, if any, has been looked up. */
  initialized: boolean;
  source: MediaSource | null;
  items: MediaItem[];
  /** Files in other formats, counted by extension. */
  skipped: Record<string, number>;
  unreadableFolders: number;
  scanning: boolean;
  /** Files seen by the running scan. */
  scanned: number;
  error: string | null;
  /** Increases after each scan, so visible thumbnails are checked again. */
  revision: number;
  init: () => Promise<void>;
  pickFolder: () => Promise<void>;
  openFileList: (list: FileList) => void;
  /** Asks for permission to the saved folder again. Needs a user click. */
  reconnect: () => Promise<boolean>;
  rescan: () => Promise<void>;
}

const SHOW_INTERVAL = 1000;

let root: SavedRoot | null = null;
let scanController: AbortController | null = null;
let initStarted = false;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function indexPaths(rootName: string, paths: string[]): MediaItem[] {
  return paths.map((path) => toMediaItem(rootName, path)).filter((item) => item !== null);
}

export const useMediaStore = create<MediaState>()((set, get) => {
  const show = (source: MediaSource, index: SavedIndex | null) => {
    scanController?.abort();
    forgetThumbs();
    set({
      source,
      items: index ? indexPaths(source.rootName, index.paths) : [],
      skipped: index?.skipped ?? {},
      unreadableFolders: 0,
      scanning: false,
      scanned: 0,
      error: null,
    });
  };

  /** With items already shown, changes are applied at the end; otherwise items appear as they are found. */
  const scan = async (source: MediaSource) => {
    scanController?.abort();
    const controller = new AbortController();
    scanController = controller;
    const previous = get().items;
    const found: MediaItem[] = [];
    const skipped: Record<string, number> = {};
    let scanned = 0;
    let shownAt = performance.now();
    set({ scanning: true, scanned: 0, error: null });
    try {
      const unreadable = await source.scan((paths) => {
        if (controller.signal.aborted) return;
        for (const path of paths) {
          const item = toMediaItem(source.rootName, path);
          if (item) {
            found.push(item);
          } else {
            const ext = extensionOf(path.slice(path.lastIndexOf('/') + 1)) || 'no extension';
            skipped[ext] = (skipped[ext] ?? 0) + 1;
          }
        }
        scanned += paths.length;
        set({ scanned });
        if (previous.length === 0 && performance.now() - shownAt > SHOW_INTERVAL) {
          set({ items: [...found] });
          shownAt = performance.now();
        }
      }, controller.signal);
      controller.signal.throwIfAborted();

      // Files in folders that could not be read this time are probably still there.
      const foundPaths = new Set(found.map((i) => i.path));
      const kept = previous.filter((item) => !foundPaths.has(item.path) && unreadable.some((dir) => item.path.startsWith(`${dir}/`)));
      const items = [...found, ...kept];
      const before = new Set(previous.map((i) => i.path));
      const unchanged = items.length === before.size && items.every((i) => before.has(i.path));
      forgetThumbs();
      set((s) => ({
        items: unchanged ? s.items : items,
        skipped,
        unreadableFolders: unreadable.length,
        scanning: false,
        revision: s.revision + 1,
      }));
      if (root && root.id === source.id) {
        saveIndex({ rootId: source.id, paths: items.map((i) => i.path), skipped }).catch(() => undefined);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      controller.abort();
      set({ scanning: false, error: `Could not read the folder "${source.rootName}": ${errorText(err)}` });
    }
  };

  return {
    initialized: false,
    source: null,
    items: [],
    skipped: {},
    unreadableFolders: 0,
    scanning: false,
    scanned: 0,
    error: null,
    revision: 0,

    init: async () => {
      if (initStarted) return;
      initStarted = true;
      void initThumbCache();
      try {
        const [saved, index] = await Promise.all([loadRoot(), loadIndex()]);
        if (!saved || get().source) return;
        const granted = (await saved.handle.queryPermission({ mode: 'read' })) === 'granted';
        if (get().source) return;
        root = saved;
        const source = createDirectorySource(saved.id, saved.handle, granted);
        show(source, index?.rootId === saved.id ? index : null);
        if (granted) void scan(source);
      } catch {
        // The saved folder cannot be used; the user can pick one again.
      } finally {
        set({ initialized: true });
      }
    },

    pickFolder: async () => {
      try {
        const handle = await pickDirectory();
        const saved = root ?? (await loadRoot()) ?? null;
        const same = saved !== null && (await saved.handle.isSameEntry(handle));
        const index = same ? await loadIndex() : undefined;
        root = { id: same ? saved.id : crypto.randomUUID(), handle };
        // Storing the handle can fail (e.g. private windows); the folder still works for this visit.
        saveRoot(root).catch(() => undefined);
        const source = createDirectorySource(root.id, handle, true);
        show(source, index?.rootId === root.id ? index : null);
        await scan(source);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        set({ error: `Could not open the folder picker: ${errorText(err)} Try "Use folder input".` });
      }
    },

    openFileList: (list) => {
      if (list.length === 0) {
        set({ error: 'The folder has no files.' });
        return;
      }
      const source = createFileListSource(list);
      show(source, null);
      void scan(source);
    },

    reconnect: async () => {
      const { source } = get();
      if (!source || source.ready) return source !== null;
      if (!root) return false;
      try {
        if ((await root.handle.requestPermission({ mode: 'read' })) !== 'granted') {
          set({ error: `Permission to read "${root.handle.name}" was not granted.` });
          return false;
        }
      } catch (err) {
        set({ error: errorText(err) });
        return false;
      }
      const ready = createDirectorySource(root.id, root.handle, true);
      set({ source: ready });
      void scan(ready);
      return true;
    },

    rescan: async () => {
      const { source } = get();
      if (source?.ready) await scan(source);
    },
  };
});
