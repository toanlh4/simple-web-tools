import { centerCrop, THUMB_QUALITY, THUMB_TYPE } from './crop';
import type { MediaItem } from './media';
import type { MediaSource } from './source';
import { getCachedThumb, putCachedThumb } from './thumbCache';
import ThumbWorker from './thumbWorker?worker&inline';
import type { ThumbReply } from './thumbWorker';

interface Job {
  /** Lower runs first. */
  rank: number;
  signal: AbortSignal;
}

/** Runs a limited number of tasks at once, lowest rank first, and drops waiting tasks that are cancelled. */
class Lane {
  private running = 0;
  private waiting: { job: Job; start: () => void }[] = [];
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  async run<T>(job: Job, task: () => Promise<T>): Promise<T> {
    job.signal.throwIfAborted();
    if (this.running < this.limit) {
      this.running++;
    } else {
      // The finishing task hands its slot over, so `running` does not change here.
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          this.waiting = this.waiting.filter((w) => w !== entry);
          reject(job.signal.reason);
        };
        const entry = {
          job,
          start: () => {
            job.signal.removeEventListener('abort', onAbort);
            resolve();
          },
        };
        job.signal.addEventListener('abort', onAbort, { once: true });
        this.waiting.push(entry);
      });
    }
    try {
      return await task();
    } finally {
      this.next();
    }
  }

  private next(): void {
    let best = -1;
    this.waiting.forEach((w, i) => {
      if (best < 0 || w.job.rank < this.waiting[best].job.rank) best = i;
    });
    if (best < 0) this.running--;
    else this.waiting.splice(best, 1)[0].start();
  }
}

const IMAGE_LIMIT = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
const VIDEO_TIMEOUT = 10_000;
const MEMORY_LIMIT = 600;

const lookupLane = new Lane(8);
const imageLane = new Lane(IMAGE_LIMIT);
const videoLane = new Lane(2);

/** Recent thumbnails, so scrolling back does not flicker. */
const memory = new Map<string, Blob>();
/** Files known to have no thumbnail in this session. */
const failed = new Set<string>();

const keyOf = (source: MediaSource, item: MediaItem) => `${source.id}\n${item.path}`;

function remember(key: string, blob: Blob): void {
  memory.delete(key);
  memory.set(key, blob);
  if (memory.size > MEMORY_LIMIT) {
    const oldest = memory.keys().next();
    if (!oldest.done) memory.delete(oldest.value);
  }
}

/** Forces thumbnails to be checked against their files again. */
export function forgetThumbs(): void {
  memory.clear();
  failed.clear();
}

async function drawThumb(image: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const { x, y, source, target } = centerCrop(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x, y, source, source, 0, 0, target, target);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), THUMB_TYPE, THUMB_QUALITY),
  );
}

async function imageThumbOnMainThread(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return await drawThumb(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

let workersBroken = false;
const idleWorkers: Worker[] = [];

/** Null when workers cannot be used here. */
function askWorker(file: File): Promise<ThumbReply | null> {
  let worker: Worker;
  try {
    worker = idleWorkers.pop() ?? new ThumbWorker();
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    worker.onmessage = (e: MessageEvent<ThumbReply>) => {
      idleWorkers.push(worker);
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(null);
    };
    worker.postMessage(file);
  });
}

async function imageThumb(file: File): Promise<Blob | null> {
  if (!workersBroken) {
    const reply = await askWorker(file);
    if (reply?.ok) return reply.blob;
    if (reply && !reply.unsupported) return null;
    workersBroken = true;
  }
  return imageThumbOnMainThread(file);
}

/** Captures one frame. Null when the video cannot be decoded; rejects on cancel or timeout. */
async function videoThumb(file: File, signal: AbortSignal): Promise<Blob | null> {
  signal.throwIfAborted();
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const cleanup = new AbortController();
  let timer = 0;
  try {
    const decoded = await new Promise<boolean>((resolve, reject) => {
      const options = { signal: cleanup.signal };
      signal.addEventListener('abort', () => reject(signal.reason), options);
      timer = window.setTimeout(() => reject(new DOMException('Video took too long', 'TimeoutError')), VIDEO_TIMEOUT);
      video.addEventListener('error', () => resolve(false), options);
      video.addEventListener('seeked', () => resolve(true), options);
      video.addEventListener(
        'loadeddata',
        () => {
          // Skip the first frame, which is often black.
          video.currentTime = Number.isFinite(video.duration) ? Math.min(1, video.duration / 4) : 0.1;
        },
        { ...options, once: true },
      );
      video.src = url;
    });
    if (!decoded || !video.videoWidth) return null;
    return await drawThumb(video, video.videoWidth, video.videoHeight);
  } finally {
    window.clearTimeout(timer);
    cleanup.abort();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function loadThumb(source: MediaSource, item: MediaItem, job: Job): Promise<Blob | null> {
  const key = keyOf(source, item);
  const inMemory = memory.get(key);
  if (inMemory) return inMemory;

  const found = await lookupLane.run(job, async () => {
    const file = source.ready ? await source.open(item.path) : null;
    return { file, blob: await getCachedThumb(key, file) };
  });
  const { file } = found;
  // Without permission the cached thumbnail cannot be verified, so it is shown but not remembered.
  if (!file) return found.blob;
  if (found.blob) {
    remember(key, found.blob);
    return found.blob;
  }

  const failKey = `${key}\n${file.size}\n${file.lastModified}`;
  if (failed.has(failKey)) return null;
  const blob =
    item.kind === 'photo'
      ? await imageLane.run(job, () => imageThumb(file))
      : await videoLane.run(job, () => videoThumb(file, job.signal));
  if (!blob) {
    failed.add(failKey);
    return null;
  }
  remember(key, blob);
  void putCachedThumb(key, file, blob);
  return blob;
}

export interface ThumbRequest {
  /** Null when there is no thumbnail to show; rejects when cancelled or unreadable. */
  promise: Promise<Blob | null>;
  setRank: (rank: number) => void;
  cancel: () => void;
}

export function requestThumb(source: MediaSource, item: MediaItem, rank: number): ThumbRequest {
  const controller = new AbortController();
  const job: Job = { rank, signal: controller.signal };
  return {
    promise: loadThumb(source, item, job),
    setRank: (next) => {
      job.rank = next;
    },
    cancel: () => controller.abort(),
  };
}
