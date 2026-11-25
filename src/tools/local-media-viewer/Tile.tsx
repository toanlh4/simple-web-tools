import { memo, useEffect, useRef, useState } from 'react';
import { ImageOff, Play, VideoOff } from 'lucide-react';
import type { MediaItem } from './media';
import type { MediaSource } from './source';
import { requestThumb, type ThumbRequest } from './thumbs';

interface TileProps {
  item: MediaItem;
  source: MediaSource;
  revision: number;
  size: number;
  /** Off-screen tiles load after the visible ones. */
  visible: boolean;
  /** Takes focus once, then calls `onFocused`. */
  focused: boolean;
  onFocused: () => void;
  onOpen: (item: MediaItem) => void;
}

export const Tile = memo(function Tile({ item, source, revision, size, visible, focused, onFocused, onOpen }: TileProps) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef<ThumbRequest | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rank = visible ? 0 : 1;

  useEffect(() => {
    let active = true;
    const request = requestThumb(source, item, 0);
    requestRef.current = request;
    request.promise.then(
      (result) => {
        if (!active) return;
        setBlob(result);
        setFailed(result === null && source.ready);
      },
      () => {
        if (!active) return;
        setBlob(null);
        setFailed(true);
      },
    );
    return () => {
      active = false;
      request.cancel();
    };
  }, [source, item, revision]);

  // Declared after the request effect, so it also sets the rank of a new request.
  useEffect(() => {
    requestRef.current?.setRank(rank);
  }, [rank, source, item, revision]);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  useEffect(() => {
    if (!focused) return;
    buttonRef.current?.focus({ preventScroll: true });
    onFocused();
  }, [focused, onFocused]);

  const FailedIcon = item.kind === 'video' ? VideoOff : ImageOff;
  return (
    <button
      ref={buttonRef}
      type="button"
      title={item.path}
      aria-label={`Open ${item.kind} ${item.name}`}
      onClick={() => onOpen(item)}
      style={{ width: size, height: size }}
      className="relative shrink-0 overflow-hidden rounded-sm bg-gray-100 outline-none hover:opacity-90 focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
    >
      {url && <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />}
      {failed && (
        <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-gray-400">
          <FailedIcon className="h-5 w-5 shrink-0" />
          <span className="w-full truncate text-center text-[10px]">{item.name}</span>
        </span>
      )}
      {item.kind === 'video' && (
        <span className="absolute right-1 bottom-1 rounded-full bg-black/60 p-1 text-white">
          <Play className="h-3 w-3 fill-current" />
        </span>
      )}
    </button>
  );
});
