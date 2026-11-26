import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle, Maximize, X } from 'lucide-react';
import type { MediaItem } from './media';
import type { MediaSource } from './source';
import { ZoomableImage, type ZoomHandle } from './ZoomableImage';

const SWIPE_DISTANCE = 50;
/** Height at the bottom of a video where swipes belong to its controls. */
const VIDEO_CONTROLS_HEIGHT = 80;

interface Entry {
  file: Promise<File>;
  url: string | null;
  released: boolean;
}

/** Opens files and owns their object URLs. */
class UrlCache {
  private readonly entries = new Map<string, Entry>();

  async load(source: MediaSource, item: MediaItem): Promise<{ file: File; url: string }> {
    let entry = this.entries.get(item.path);
    if (!entry) {
      entry = { file: source.open(item.path), url: null, released: false };
      this.entries.set(item.path, entry);
    }
    const file = await entry.file;
    if (entry.released) throw new DOMException('Released', 'AbortError');
    entry.url ??= URL.createObjectURL(file);
    return { file, url: entry.url };
  }

  keepOnly(paths: string[]): void {
    for (const [path, entry] of this.entries) {
      if (paths.includes(path)) continue;
      entry.released = true;
      if (entry.url) URL.revokeObjectURL(entry.url);
      this.entries.delete(path);
    }
  }
}

function readErrorText(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotFoundError') return 'This file no longer exists. It may have been moved, renamed or deleted.';
  if (name === 'NotAllowedError') return 'The browser no longer has permission to read this folder. Close the viewer and reopen the folder.';
  return `This file could not be read. ${err instanceof Error ? err.message : ''}`;
}

type Loaded = { path: string; file: File; url: string };
type Failure = { path: string; text: string };

interface ViewerProps {
  items: MediaItem[];
  source: MediaSource;
  item: MediaItem;
  onChange: (item: MediaItem) => void;
  onClose: () => void;
}

export function Viewer({ items, source, item, onChange, onClose }: ViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef<ZoomHandle>(null);
  const zoomedRef = useRef(false);
  const onZoomedChange = useCallback((zoomed: boolean) => {
    zoomedRef.current = zoomed;
  }, []);
  const [cache] = useState(() => new UrlCache());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  // A rescan can drop the open file; then move on from where it was.
  const lastIndex = useRef(0);
  const index = items.findIndex((i) => i.path === item.path);
  useEffect(() => {
    if (index >= 0) lastIndex.current = index;
  }, [index]);
  const at = index >= 0 ? index : lastIndex.current;
  const previous: MediaItem | undefined = items[at - 1];
  const next: MediaItem | undefined = items[index >= 0 ? at + 1 : at];

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    frameRef.current?.focus();
    return () => {
      dialog?.close();
      cache.keepOnly([]);
    };
  }, [cache]);

  useEffect(() => {
    let active = true;
    const neighbours = [next, previous].filter((n) => n !== undefined);
    cache.keepOnly([item, ...neighbours].map((i) => i.path));
    cache.load(source, item).then(
      ({ file, url }) => {
        if (!active) return;
        setLoaded({ path: item.path, file, url });
        for (const neighbour of neighbours) {
          if (neighbour.kind !== 'photo') continue;
          cache
            .load(source, neighbour)
            .then(({ url: preload }) => {
              if (!active) return undefined;
              const image = new Image();
              image.src = preload;
              return image.decode();
            })
            .catch(() => undefined);
        }
      },
      (err: unknown) => {
        if (active) setFailure({ path: item.path, text: readErrorText(err) });
      },
    );
    return () => {
      active = false;
    };
  }, [cache, source, item, next, previous]);

  const media = loaded?.path === item.path ? loaded : null;
  const error = failure?.path === item.path ? failure.text : null;

  /** The element's error does not say whether decoding or reading failed, so try reading. */
  const onMediaError = async () => {
    if (!media) return;
    let text = `This browser cannot decode this ${item.kind}. Its format or codec may not be supported.`;
    try {
      await media.file.slice(0, 1).arrayBuffer();
    } catch (err) {
      text = readErrorText(err);
    }
    setFailure({ path: media.path, text });
  };

  const go = (target: MediaItem | undefined) => {
    if (target) onChange(target);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else frameRef.current?.requestFullscreen().catch(() => undefined);
  };

  // Capture phase, so the arrow keys change the file instead of seeking in a focused video.
  const onKeyDown = (e: globalThis.KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        go(previous);
        break;
      case 'ArrowRight':
      case 'PageDown':
        go(next);
        break;
      case 'Home':
        go(items[0]);
        break;
      case 'End':
        go(items[items.length - 1]);
        break;
      case 'f':
        toggleFullscreen();
        break;
      case '+':
      case '=':
        zoomRef.current?.zoomIn();
        break;
      case '-':
        zoomRef.current?.zoomOut();
        break;
      case '0':
        zoomRef.current?.reset();
        break;
      case ' ': {
        const video = videoRef.current;
        if (!video || e.target === video || e.target instanceof HTMLButtonElement) return;
        if (video.paused) video.play().catch(() => undefined);
        else video.pause();
        break;
      }
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  // On the document rather than the dialog: clicking the photo moves focus to the body, outside the dialog.
  const onKeyDownRef = useRef(onKeyDown);
  useEffect(() => {
    onKeyDownRef.current = onKeyDown;
  });
  useEffect(() => {
    const listener = (e: globalThis.KeyboardEvent) => onKeyDownRef.current(e);
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, []);
  const onTouchStart = (e: TouchEvent) => {
    touchRef.current = null;
    // While zoomed in, one finger pans the photo instead.
    if (e.touches.length !== 1 || zoomedRef.current) return;
    const { clientX: x, clientY: y } = e.touches[0];
    const video = videoRef.current;
    if (video && e.target === video && y > video.getBoundingClientRect().bottom - VIDEO_CONTROLS_HEIGHT) return;
    touchRef.current = { x, y };
  };

  const onTouchEnd = (e: TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? next : previous);
  };

  const iconButton = 'rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-20';

  return (
    <dialog
      ref={dialogRef}
      aria-label={item.name}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 h-full max-h-none w-full max-w-none border-0 bg-black p-0 text-white"
    >
      <div
        ref={frameRef}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex h-full touch-pan-y flex-col bg-black outline-none"
      >
        <div className="flex h-11 shrink-0 items-center gap-2 px-3 text-xs">
          <span className="min-w-0 truncate" title={item.path}>
            {item.path}
          </span>
          <span className="shrink-0 text-white/50">{index >= 0 && `${(index + 1).toLocaleString()} / ${items.length.toLocaleString()}`}</span>
          <div className="ml-auto flex shrink-0">
            <button type="button" onClick={toggleFullscreen} className={iconButton} title="Full screen (F)" aria-label="Full screen">
              <Maximize className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className={iconButton} title="Close (Esc)" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {error ? (
            <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-16 text-center text-sm text-white/80">
              <FileWarning className="h-10 w-10 text-white/50" />
              {error}
            </div>
          ) : !media ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-white/50" />
            </div>
          ) : item.kind === 'photo' ? (
            <ZoomableImage key={media.url} ref={zoomRef} src={media.url} alt={item.name} onError={onMediaError} onZoomedChange={onZoomedChange} />
          ) : (
            <video
              key={media.url}
              ref={videoRef}
              src={media.url}
              controls
              autoPlay
              playsInline
              onError={onMediaError}
              className="h-full w-full object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => go(previous)}
            disabled={!previous}
            title="Previous (←)"
            aria-label="Previous"
            className={`${iconButton} absolute top-1/2 left-2 -translate-y-1/2 bg-black/40`}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => go(next)}
            disabled={!next}
            title="Next (→)"
            aria-label="Next"
            className={`${iconButton} absolute top-1/2 right-2 -translate-y-1/2 bg-black/40`}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </dialog>
  );
}
