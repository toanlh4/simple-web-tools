import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { buildLayout, findRow, GAP, rowOfItem, type Layout } from './layout';
import { dayLabel, monthLabel, type MediaGroup, type MediaItem, type SortOrder } from './media';
import type { MediaSource } from './source';
import { Tile } from './Tile';

const OVERSCAN = 400;

export interface TimelineHandle {
  scrollToMonth: (month: string | null) => void;
  /** Brings the item into view, unless it already is, and focuses it. */
  revealItem: (item: MediaItem) => void;
}

interface TimelineProps {
  ref: Ref<TimelineHandle>;
  items: MediaItem[];
  groups: MediaGroup[];
  order: SortOrder;
  source: MediaSource;
  revision: number;
  tileSize: number;
  onOpen: (item: MediaItem) => void;
  onMonthChange: (month: string | null) => void;
}

interface Anchor {
  path: string;
  groupKey: string;
  /** Scroll position relative to the top of the item's row. */
  delta: number;
}

function anchorAt(layout: Layout, items: MediaItem[], scrollTop: number): Anchor | null {
  for (let i = findRow(layout.offsets, scrollTop); i < layout.rows.length; i++) {
    const row = layout.rows[i];
    if (row.type !== 'tiles') continue;
    return { path: items[row.start].path, groupKey: row.group.key, delta: scrollTop - layout.offsets[i] };
  }
  return null;
}

export function Timeline({ ref, items, groups, order, source, revision, tileSize, onOpen, onMonthChange }: TimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const clearFocus = useCallback(() => setFocusPath(null), []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const measure = () => setViewport({ width: content.clientWidth, height: scroller.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => buildLayout(groups, viewport.width, tileSize), [groups, viewport.width, tileSize]);

  // Keep the same item at the top when the layout changes under the user.
  const shown = useRef({ layout, items, order });
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const before = shown.current;
    shown.current = { layout, items, order };
    if (!scroller || before.layout === layout) return;
    let top = scroller.scrollTop;
    if (before.order !== order) {
      top = 0;
    } else if (scrollTop > 0) {
      // `scrollTop` state is the position in the old layout; the browser may have clamped the element's own.
      const anchor = anchorAt(before.layout, before.items, scrollTop);
      if (anchor) {
        const index = items.findIndex((i) => i.path === anchor.path);
        const row = index >= 0 ? rowOfItem(layout.rows, index) : layout.rows.findIndex((r) => r.group.key === anchor.groupKey);
        if (row >= 0) top = layout.offsets[row] + Math.min(anchor.delta, layout.tile);
      }
    }
    scroller.scrollTop = top;
    setScrollTop(scroller.scrollTop);
  }, [layout, items, order, scrollTop]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToMonth: (month) => {
        const row = layout.rows.findIndex((r) => r.type === 'month' && r.group.month === month);
        if (row >= 0) scrollerRef.current?.scrollTo({ top: layout.offsets[row] });
      },
      revealItem: (item) => {
        const scroller = scrollerRef.current;
        const index = items.findIndex((i) => i.path === item.path);
        const row = index >= 0 ? rowOfItem(layout.rows, index) : -1;
        if (!scroller || row < 0) return;
        const top = layout.offsets[row];
        if (top < scroller.scrollTop || top + layout.tile > scroller.scrollTop + scroller.clientHeight) {
          scroller.scrollTop = top - (scroller.clientHeight - layout.tile) / 2;
        }
        setFocusPath(item.path);
      },
    }),
    [layout, items],
  );

  const current = layout.rows[findRow(layout.offsets, scrollTop)]?.group;
  const month = current?.month ?? null;
  useEffect(() => {
    onMonthChange(month);
  }, [month, onMonthChange]);

  const bottom = scrollTop + viewport.height;
  // Room after the end, so that a jump to the last month can also reach the top.
  const total = layout.offsets[layout.offsets.length - 1];
  const lastMonthRow = layout.rows.findLastIndex((r) => r.type === 'month');
  const contentHeight = lastMonthRow >= 0 ? Math.max(total, layout.offsets[lastMonthRow] + viewport.height) : total;
  const visibleRows: number[] = [];
  if (viewport.width > 0) {
    for (let i = findRow(layout.offsets, scrollTop - OVERSCAN); i < layout.rows.length && layout.offsets[i] < bottom + OVERSCAN; i++) {
      visibleRows.push(i);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-gray-200 px-3 text-xs dark:border-gray-800">
        {current && (
          <>
            <span className="font-semibold">{monthLabel(current.month)}</span>
            <span className="text-gray-500 dark:text-gray-400">{dayLabel(current.month, current.day)}</span>
          </>
        )}
      </div>
      <div
        ref={scrollerRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-y-scroll px-3"
        style={{ overflowAnchor: 'none' }}
      >
        <div ref={contentRef} className="relative" style={{ height: contentHeight }}>
          {visibleRows.map((i) => {
            const row = layout.rows[i];
            const top = layout.offsets[i];
            const height = layout.offsets[i + 1] - top;
            if (row.type !== 'tiles') {
              return (
                <div key={`${row.type}:${row.group.key}`} className="absolute inset-x-0 flex items-center gap-2" style={{ top, height }}>
                  {row.type === 'month' ? (
                    <h2 className="pt-3 text-lg font-semibold">{monthLabel(row.group.month)}</h2>
                  ) : (
                    <>
                      <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300">{dayLabel(row.group.month, row.group.day)}</h3>
                      <span className="text-xs text-gray-400">{row.group.end - row.group.start}</span>
                    </>
                  )}
                </div>
              );
            }
            const visible = top < bottom && top + height > scrollTop;
            return (
              <div key={items[row.start].path} className="absolute left-0 flex" style={{ top, gap: GAP }}>
                {items.slice(row.start, row.end).map((item) => (
                  <Tile
                    key={item.path}
                    item={item}
                    source={source}
                    revision={revision}
                    size={layout.tile}
                    visible={visible}
                    focused={item.path === focusPath}
                    onFocused={clearFocus}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
