/** The parts of the File System Access API that TypeScript's DOM types may not cover. */
export interface DirHandle extends FileSystemDirectoryHandle {
  queryPermission(descriptor: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'read' }): Promise<PermissionState>;
}

interface PickerWindow {
  showDirectoryPicker?: (options: { mode: 'read'; id: string }) => Promise<DirHandle>;
}

export function canPickDirectory(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

export function pickDirectory(): Promise<DirHandle> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return Promise.reject(new Error('This browser has no folder picker.'));
  return picker.call(window, { mode: 'read', id: 'local-media-viewer' });
}

export interface MediaSource {
  /** Identifies the folder in the thumbnail cache. */
  id: string;
  rootName: string;
  /** False while the browser still needs permission to read the folder. */
  ready: boolean;
  /** Reports every file path in batches. Resolves with the folders that could not be read. */
  scan(onBatch: (paths: string[]) => void, signal: AbortSignal): Promise<string[]>;
  open(path: string): Promise<File>;
}

const BATCH_SIZE = 500;
const SCAN_CONCURRENCY = 8;

export function createDirectorySource(id: string, root: DirHandle, ready: boolean): MediaSource {
  const dirs = new Map<string, Promise<FileSystemDirectoryHandle>>();

  const getDir = (path: string): Promise<FileSystemDirectoryHandle> => {
    if (!path) return Promise.resolve(root);
    const cached = dirs.get(path);
    if (cached) return cached;
    const slash = path.lastIndexOf('/');
    const opened = getDir(path.slice(0, Math.max(0, slash))).then((parent) => parent.getDirectoryHandle(path.slice(slash + 1)));
    dirs.set(path, opened);
    opened.catch(() => dirs.delete(path));
    return opened;
  };

  return {
    id,
    rootName: root.name,
    ready,
    async scan(onBatch, signal) {
      const failed: string[] = [];
      const queue = [''];
      let batch: string[] = [];
      const flush = () => {
        if (batch.length === 0) return;
        onBatch(batch);
        batch = [];
      };
      const readDir = async (dir: string) => {
        try {
          const handle = await getDir(dir);
          for await (const entry of handle.values()) {
            signal.throwIfAborted();
            const path = dir ? `${dir}/${entry.name}` : entry.name;
            if (entry.kind === 'directory') queue.push(path);
            else batch.push(path);
            if (batch.length >= BATCH_SIZE) flush();
          }
        } catch (err) {
          // Without the root (e.g. an unplugged drive) there is nothing to scan.
          if (signal.aborted || !dir) throw err;
          failed.push(dir);
        }
      };
      const running = new Set<Promise<void>>();
      while (queue.length > 0 || running.size > 0) {
        while (queue.length > 0 && running.size < SCAN_CONCURRENCY) {
          const task: Promise<void> = readDir(queue.shift() ?? '').finally(() => running.delete(task));
          // Several tasks can fail at once on abort; only the first is reported through the race.
          task.catch(() => undefined);
          running.add(task);
        }
        await Promise.race(running);
      }
      flush();
      return failed;
    },
    async open(path) {
      const slash = path.lastIndexOf('/');
      const dir = await getDir(path.slice(0, Math.max(0, slash)));
      return (await dir.getFileHandle(path.slice(slash + 1))).getFile();
    },
  };
}

/** Source for `<input type="file" webkitdirectory>`, where every path starts with the picked folder's name. */
export function createFileListSource(list: FileList): MediaSource {
  const rootName = list[0]?.webkitRelativePath.split('/')[0] ?? '';
  const files = new Map(Array.from(list, (file) => [file.webkitRelativePath.slice(rootName.length + 1), file]));
  return {
    id: `list:${rootName}`,
    rootName,
    ready: true,
    async scan(onBatch, signal) {
      const paths = [...files.keys()];
      for (let i = 0; i < paths.length; i += BATCH_SIZE) {
        signal.throwIfAborted();
        onBatch(paths.slice(i, i + BATCH_SIZE));
      }
      return [];
    },
    async open(path) {
      const file = files.get(path);
      if (!file) throw new DOMException('File not found', 'NotFoundError');
      return file;
    },
  };
}
