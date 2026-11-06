import { useLayoutEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { formatPercent, formatSize, heapReserved, type HeapInfo } from './parse';
import { buildHeapBlocks, freeTint, SEGMENTS, type HeapBlock } from './segments';

/** Room a label like `100.0%` needs inside a block, padding included. */
const LABEL_WIDTH = 48;
const TOOLTIP_WIDTH = 224;

/** A label sits on one flat color, so its ink stays readable; a block with room for neither gets none. */
function labelPlacement(block: HeapBlock, width: number): 'used' | 'free' | null {
  const usedWidth = (block.used / block.size) * width;
  if (usedWidth >= LABEL_WIDTH) return 'used';
  if (width - usedWidth >= LABEL_WIDTH) return 'free';
  return null;
}

function describe(block: HeapBlock, total: number): string {
  const share = `${formatPercent(block.size, total)} of max heap`;
  if (!block.committed) return `${block.name}: ${formatSize(block.size)}, ${share}`;
  return `${block.name}: ${formatSize(block.used)} used of ${formatSize(block.size)} (${formatPercent(block.used, block.size)}), ${share}`;
}

export function HeapMap({ info }: { info: HeapInfo }) {
  const blocks = useMemo(() => buildHeapBlocks(info), [info]);
  const total = heapReserved(info);
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [active, setActive] = useState<{ block: HeapBlock; center: number } | null>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => setBarWidth(bar.clientWidth));
    observer.observe(bar);
    setBarWidth(bar.clientWidth);
    return () => observer.disconnect();
  }, []);

  const legendKeys = [...new Set(blocks.map((block) => block.key))];
  const showTooltip = (block: HeapBlock) => (e: SyntheticEvent<HTMLDivElement>) =>
    setActive({ block, center: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2 });
  const hideTooltip = () => setActive(null);

  const tooltipLeft = active ? Math.max(0, Math.min(active.center - TOOLTIP_WIDTH / 2, barWidth - TOOLTIP_WIDTH)) : 0;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-semibold">Heap memory map</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          The whole {formatSize(total)} max heap in address order. Each block's width and label show its share of the max heap.
        </p>
      </div>

      <div className="flex gap-0.5 pt-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span style={{ flexGrow: info.young.reserved, flexBasis: 0 }} className="min-w-0 truncate border-b border-gray-300 pb-0.5 dark:border-gray-700">
          Young · {formatSize(info.young.reserved)}
        </span>
        <span style={{ flexGrow: info.old.reserved, flexBasis: 0 }} className="min-w-0 truncate border-b border-gray-300 pb-0.5 dark:border-gray-700">
          Tenured · {formatSize(info.old.reserved)}
        </span>
      </div>

      <div ref={barRef} role="group" aria-label="Heap memory map" className="relative flex h-7 gap-0.5">
        {blocks.map((block) => {
          const { color, onColor } = SEGMENTS[block.key];
          const widthShare = block.size / total;
          const placement = labelPlacement(block, widthShare * barWidth);
          const share = formatPercent(block.size, total);
          return (
            <div
              key={block.id}
              role="img"
              tabIndex={0}
              aria-label={describe(block, total)}
              onMouseEnter={showTooltip(block)}
              onMouseLeave={hideTooltip}
              onFocus={showTooltip(block)}
              onBlur={hideTooltip}
              style={{ flexGrow: block.size, flexBasis: 0, backgroundColor: block.committed ? freeTint(color) : color }}
              className="relative min-w-[3px] cursor-default overflow-hidden rounded outline-offset-1 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              {block.used > 0 && (
                <div className="absolute inset-y-0 left-0" style={{ width: `${(block.used / block.size) * 100}%`, backgroundColor: color }} />
              )}
              {placement === 'used' && (
                <span className="absolute inset-y-0 left-1.5 flex items-center text-[11px] font-medium" style={{ color: onColor }}>
                  {share}
                </span>
              )}
              {placement === 'free' && (
                <span className="absolute inset-y-0 right-1.5 flex items-center text-[11px] font-medium text-gray-900 dark:text-gray-100">{share}</span>
              )}
            </div>
          );
        })}

        {active && (
          <div
            style={{ left: tooltipLeft, width: TOOLTIP_WIDTH }}
            className="pointer-events-none absolute bottom-full z-10 mb-2 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="font-semibold">{active.block.name}</div>
            {active.block.committed ? (
              <div className="text-gray-600 dark:text-gray-300">
                {formatSize(active.block.used)} used of {formatSize(active.block.size)} ({formatPercent(active.block.used, active.block.size)})
              </div>
            ) : (
              <div className="text-gray-600 dark:text-gray-300">{formatSize(active.block.size)} reserved, not yet committed</div>
            )}
            <div className="text-gray-500 dark:text-gray-400">{formatPercent(active.block.size, total)} of max heap</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        {legendKeys.map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SEGMENTS[key].color }} />
            {SEGMENTS[key].name}
          </span>
        ))}
        <span className="text-gray-500 dark:text-gray-400">Solid is used, light is free.</span>
      </div>
    </section>
  );
}
