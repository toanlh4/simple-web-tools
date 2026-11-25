import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatBytes, shortMonthLabel, type MonthCount } from './media';
import { clearThumbCache, useThumbCacheSize } from './thumbCache';

interface MonthSidebarProps {
  months: MonthCount[];
  /** Undefined when the timeline is empty. */
  active: string | null | undefined;
  onJump: (month: string | null) => void;
}

interface Year {
  year: string;
  count: number;
  months: { month: string; count: number }[];
}

export function MonthSidebar({ months, active, onJump }: MonthSidebarProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const bytes = useThumbCacheSize((s) => s.bytes);
  const activeRef = useRef<HTMLButtonElement>(null);

  const { years, undated } = useMemo(() => {
    const list: Year[] = [];
    let undatedCount = 0;
    for (const { month, count } of months) {
      if (month === null) {
        undatedCount = count;
        continue;
      }
      let year = list[list.length - 1];
      if (year?.year !== month.slice(0, 4)) {
        year = { year: month.slice(0, 4), count: 0, months: [] };
        list.push(year);
      }
      year.count += count;
      year.months.push({ month, count });
    }
    return { years: list, undated: undatedCount };
  }, [months]);

  // Braces matter: scrollIntoView returns a promise in newer browsers, which is not a valid effect cleanup.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const toggle = (year: string) => {
    const next = new Set(collapsed);
    if (!next.delete(year)) next.add(year);
    setCollapsed(next);
  };

  const clearCache = () => {
    if (!window.confirm('Delete all cached thumbnails? They are created again when needed. Your media files are not touched.')) return;
    clearThumbCache().catch((err: unknown) => window.alert(`Could not clear the cache: ${String(err)}`));
  };

  const monthButton = (month: string | null, label: string, count: number, indent: string) => (
    <button
      key={label}
      ref={active === month ? activeRef : undefined}
      type="button"
      onClick={() => onJump(month)}
      aria-current={active === month ? 'true' : undefined}
      className={`flex w-full items-center rounded-md py-1 pr-2 text-left text-xs ${indent} ${
        active === month ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {label}
      <span className="ml-auto text-gray-400">{count.toLocaleString()}</span>
    </button>
  );

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-gray-200 dark:border-gray-800">
      <nav aria-label="Jump to month" className="min-h-0 flex-1 overflow-y-auto p-2">
        {years.map((y) => {
          const open = !collapsed.has(y.year);
          const Chevron = open ? ChevronDown : ChevronRight;
          return (
            <div key={y.year}>
              <div className="flex items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <button
                  type="button"
                  onClick={() => toggle(y.year)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Collapse' : 'Expand'} ${y.year}`}
                  className="p-1 text-gray-400"
                >
                  <Chevron className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onJump(y.months[0].month)} className="flex flex-1 items-center py-1 pr-2 text-left text-xs font-semibold">
                  {y.year}
                  <span className="ml-auto font-normal text-gray-400">{y.count.toLocaleString()}</span>
                </button>
              </div>
              {open && y.months.map((m) => monthButton(m.month, shortMonthLabel(m.month), m.count, 'pl-6'))}
            </div>
          );
        })}
        {undated > 0 && monthButton(null, 'Undated', undated, 'pl-2 font-semibold')}
      </nav>
      <div className="flex items-center justify-between gap-2 border-t border-gray-200 p-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <span title="Thumbnails kept in this browser">Thumbnails: {formatBytes(bytes)}</span>
        <button type="button" onClick={clearCache} disabled={bytes === 0} className="btn-secondary px-2" title="Delete cached thumbnails">
          Clear
        </button>
      </div>
    </aside>
  );
}
