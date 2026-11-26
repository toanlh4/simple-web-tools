import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent, type Ref } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { actualSizeScale, clampView, FIT, zoomAt, type ZoomBox, type ZoomView } from './zoom';

const BUTTON_STEP = 1.5;
/** Pointer movement below this is a click, not a drag. */
const DRAG_THRESHOLD = 4;

export interface ZoomHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}

interface ZoomableImageProps {
  ref: Ref<ZoomHandle>;
  src: string;
  alt: string;
  onError: () => void;
  /** Lets the viewer ignore swipes while the image is zoomed in. */
  onZoomedChange: (zoomed: boolean) => void;
}

type Point = { x: number; y: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ZoomableImage({ ref, src, alt, onError, onZoomedChange }: ZoomableImageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<ZoomBox>({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [view, setView] = useState<ZoomView>(FIT);
  // Read by the native wheel listener and pointer handlers, which must see the latest values.
  const latest = useRef({ box, view });
  latest.current = { box, view };
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ start: Point; view: ZoomView; pinch: number; moved: boolean } | null>(null);

  const zoomed = view.scale > 1;
  useEffect(() => {
    onZoomedChange(zoomed);
  }, [zoomed, onZoomedChange]);

  useEffect(() => setView((v) => clampView(v, box)), [box]);

  const local = (clientX: number, clientY: number): Point => {
    const rect = boxRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const zoomBy = useCallback((factor: number, point?: Point) => {
    const { box: b, view: v } = latest.current;
    setView(zoomAt(v, b, v.scale * factor, point?.x ?? b.width / 2, point?.y ?? b.height / 2));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => zoomBy(BUTTON_STEP),
      zoomOut: () => zoomBy(1 / BUTTON_STEP),
      reset: () => setView(FIT),
    }),
    [zoomBy],
  );

  // Follow viewport resizes, keeping the scale.
  useLayoutEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setBox((b) => ({ ...b, width: element.clientWidth, height: element.clientHeight })));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // React's wheel listener is passive, so it cannot stop the page from scrolling.
  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pixels = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
      // Trackpad pinches arrive as wheel events with ctrlKey and small deltas.
      zoomBy(Math.exp(-pixels * (e.ctrlKey ? 0.01 : 0.002)), local(e.clientX, e.clientY));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const startGesture = () => {
    const points = [...pointers.current.values()];
    if (points.length === 0) {
      gesture.current = null;
      return;
    }
    const start = points.length >= 2 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
    gesture.current = {
      start,
      view: latest.current.view,
      pinch: points.length >= 2 ? distance(points[0], points[1]) : 0,
      moved: gesture.current?.moved ?? false,
    };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY));
    if (pointers.current.size === 1) gesture.current = null;
    startGesture();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e.clientX, e.clientY));
    const g = gesture.current;
    if (!g) return;
    const points = [...pointers.current.values()];
    const { box: b } = latest.current;
    if (points.length >= 2 && g.pinch > 0) {
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const scaled = zoomAt(g.view, b, (g.view.scale * distance(points[0], points[1])) / g.pinch, g.start.x, g.start.y);
      g.moved = true;
      setView(clampView({ ...scaled, x: scaled.x + mid.x - g.start.x, y: scaled.y + mid.y - g.start.y }, b));
    } else if (g.view.scale > 1) {
      const dx = points[0].x - g.start.x;
      const dy = points[0].y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      g.moved = true;
      setView(clampView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy }, b));
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    // Continue with the remaining finger from where the pinch left off.
    startGesture();
  };

  const onDoubleClick = (e: { clientX: number; clientY: number }) => {
    const { box: b, view: v } = latest.current;
    if (v.scale > 1) setView(FIT);
    else {
      const point = local(e.clientX, e.clientY);
      setView(zoomAt(v, b, Math.max(2, actualSizeScale(b)), point.x, point.y));
    }
  };

  const percent = Math.round((view.scale / actualSizeScale(box)) * 100);
  const control = 'rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30';

  return (
    <div className="absolute inset-0">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        className={`absolute inset-0 touch-none overflow-hidden select-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={onError}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            setBox((b) => ({ ...b, naturalWidth, naturalHeight }));
          }}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
          className="h-full w-full object-contain"
        />
      </div>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-1 py-0.5 text-xs text-white">
        <button type="button" onClick={() => zoomBy(1 / BUTTON_STEP)} disabled={!zoomed} className={control} title="Zoom out (-)" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setView(FIT)}
          disabled={!zoomed}
          className="w-12 rounded-full py-1 tabular-nums hover:bg-white/15 disabled:pointer-events-none"
          title="Fit to screen (0)"
        >
          {box.naturalWidth > 0 ? `${percent}%` : '–'}
        </button>
        <button type="button" onClick={() => zoomBy(BUTTON_STEP)} className={control} title="Zoom in (+)" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
