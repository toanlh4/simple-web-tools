import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, FolderOpen, Images, LockOpen, PanelLeft, RefreshCw } from 'lucide-react';
import { countMonths, groupItems, sortItems, type KindFilter, type MediaItem } from './media';
import { MonthSidebar } from './MonthSidebar';
import { canPickDirectory } from './source';
import { Timeline, type TimelineHandle } from './Timeline';
import { useMediaStore } from './useMediaStore';
import { TILE_MAX, TILE_MIN, usePrefsStore } from './usePrefsStore';
import { Viewer } from './Viewer';

// React types do not include this attribute.
const FOLDER_INPUT = { webkitdirectory: '' };

const FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Videos' },
];

export function LocalMediaViewerPage() {
  const { initialized, source, items, skipped, unreadableFolders, scanning, scanned, error, revision } = useMediaStore();
  const { init, pickFolder, openFileList, reconnect, rescan } = useMediaStore.getState();
  const { order, filter, tileSize, sidebarOpen } = usePrefsStore();
  const { setOrder, setFilter, setTileSize, setSidebarOpen } = usePrefsStore.getState();
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MediaItem | null>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void init();
  }, [init]);

  const sorted = useMemo(() => sortItems(items, order), [items, order]);
  const shown = useMemo(() => (filter === 'all' ? sorted : sorted.filter((i) => i.kind === filter)), [sorted, filter]);
  const groups = useMemo(() => groupItems(shown), [shown]);
  const months = useMemo(() => countMonths(groups), [groups]);

  const skippedEntries = Object.entries(skipped).sort((a, b) => b[1] - a[1]);
  const skippedCount = skippedEntries.reduce((sum, [, count]) => sum + count, 0);

  const openItem = useCallback(
    async (item: MediaItem) => {
      if (await reconnect()) setViewing(item);
    },
    [reconnect],
  );

  const closeViewer = () => {
    const last = viewing;
    setViewing(null);
    if (last) timelineRef.current?.revealItem(last);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Resetting the input also empties its live FileList, so it is read first.
    if (e.target.files) openFileList(e.target.files);
    e.target.value = '';
  };

  const pick = () => {
    if (canPickDirectory()) void pickFolder();
    else inputRef.current?.click();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <input ref={inputRef} type="file" {...FOLDER_INPUT} multiple onChange={onInputChange} className="hidden" aria-label="Media folder" />

      {source && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`toolbar-btn ${sidebarOpen ? 'toolbar-btn-active' : ''}`}
            title="Show or hide the month list"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <span className="max-w-60 truncate font-semibold" title={source.rootName}>
            {source.rootName}
          </span>
          <span className="text-gray-400">
            {shown.length.toLocaleString()} file(s)
            {skippedCount > 0 && (
              <span title={skippedEntries.map(([ext, count]) => `${ext}: ${count}`).join('\n')}> · {skippedCount.toLocaleString()} skipped</span>
            )}
            {unreadableFolders > 0 && <span className="text-red-600 dark:text-red-400"> · {unreadableFolders} unreadable folder(s)</span>}
            {scanning && ` · scanning… ${scanned.toLocaleString()}`}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center" role="group" aria-label="File type">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={filter === f.value}
                  className={`toolbar-btn ${filter === f.value ? 'toolbar-btn-active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="toolbar-sep" />
            <button type="button" onClick={() => setOrder(order === 'newest' ? 'oldest' : 'newest')} className="toolbar-btn" title="Change the order">
              {order === 'newest' ? <ArrowDownWideNarrow className="h-4 w-4" /> : <ArrowUpNarrowWide className="h-4 w-4" />}
              {order === 'newest' ? 'Newest first' : 'Oldest first'}
            </button>
            <div className="toolbar-sep" />
            <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              Size
              <input
                type="range"
                min={TILE_MIN}
                max={TILE_MAX}
                step={20}
                value={tileSize}
                onChange={(e) => setTileSize(Number(e.target.value))}
                className="w-24"
              />
            </label>
            <div className="toolbar-sep" />
            <button type="button" onClick={() => void rescan()} disabled={scanning || !source.ready} className="btn-secondary" title="Look for added and removed files">
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} /> Rescan
            </button>
            <button type="button" onClick={pick} className="btn-secondary" title="Pick another media folder">
              <FolderOpen className="h-3.5 w-3.5" /> Change folder
            </button>
          </div>
        </div>
      )}

      {source && !source.ready && (
        <div className="flex shrink-0 items-center gap-3 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          The browser needs your permission to read "{source.rootName}" again.
          <button type="button" onClick={() => void reconnect()} className="btn-primary">
            <LockOpen className="h-3.5 w-3.5" /> Allow access
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex shrink-0 items-center gap-3 px-3 py-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {source && items.length > 0 ? (
        <div className="flex min-h-0 flex-1">
          {sidebarOpen && (
            <MonthSidebar months={months} active={groups.length > 0 ? activeMonth : undefined} onJump={(m) => timelineRef.current?.scrollToMonth(m)} />
          )}
          {shown.length > 0 ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <Timeline
                key={source.id}
                ref={timelineRef}
                items={shown}
                groups={groups}
                order={order}
                source={source}
                revision={revision}
                tileSize={tileSize}
                onOpen={openItem}
                onMonthChange={setActiveMonth}
              />
            </div>
          ) : (
            <p className="flex-1 p-6 text-center text-sm text-gray-500">No files of this type.</p>
          )}
        </div>
      ) : (
        initialized && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <Images className="h-10 w-10 text-gray-400" />
            {source && scanning ? (
              <p className="text-sm text-gray-500">Scanning "{source.rootName}"…</p>
            ) : (
              <>
                <p className="max-w-md text-sm text-gray-600 dark:text-gray-300">
                  {source?.ready && !error
                    ? `No supported photos or videos in "${source.rootName}".`
                    : 'Pick a folder organized as YYYY/YYYY-MM/DD to see all its photos and videos on one timeline. Files are only read, never copied or uploaded.'}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={pick} className="btn-primary">
                    <FolderOpen className="h-3.5 w-3.5" /> Pick media folder
                  </button>
                  {canPickDirectory() && (
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="btn-secondary"
                      title="For when the folder picker does not work. The folder must be picked again on each visit."
                    >
                      Use folder input
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )
      )}

      {viewing && source && <Viewer items={shown} source={source} item={viewing} onChange={setViewing} onClose={closeViewer} />}
    </div>
  );
}
