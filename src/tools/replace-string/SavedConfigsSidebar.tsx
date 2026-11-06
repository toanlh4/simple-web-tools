import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { PanelRightClose, Trash2, Upload, X } from 'lucide-react';
import { formatDateTime } from '../../utils/formatDateTime';
import { SIDEBAR_MIN_WIDTH, useSavedConfigsStore, type SavedConfig } from './useSavedConfigsStore';

const SIDEBAR_MAX_WIDTH = 640;

function maxWidth(): number {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth * 0.7));
}

interface SavedConfigsSidebarProps {
  onImport: (config: SavedConfig) => void;
  onMessage: (text: string) => void;
}

export function SavedConfigsSidebar({ onImport, onMessage }: SavedConfigsSidebarProps) {
  const configs = useSavedConfigsStore((s) => s.configs);
  const storedWidth = useSavedConfigsStore((s) => s.sidebarWidth);
  const { removeConfig, clearAll, setSidebarOpen, setSidebarWidth } = useSavedConfigsStore.getState();
  // Width while dragging lives in local state; it is persisted once on release.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const width = Math.min(dragWidth ?? storedWidth, maxWidth());
  const sorted = useMemo(() => [...configs].sort((a, b) => b.savedAt.localeCompare(a.savedAt)), [configs]);

  const onResizeStart = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
    setDragWidth(width);
  };
  const onResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const next = drag.current.startWidth + (drag.current.startX - e.clientX);
    setDragWidth(Math.min(maxWidth(), Math.max(SIDEBAR_MIN_WIDTH, next)));
  };
  const onResizeEnd = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dragWidth !== null) setSidebarWidth(dragWidth);
    setDragWidth(null);
  };

  const remove = (config: SavedConfig) => {
    removeConfig(config.id);
    onMessage(`Removed saved config "${config.name}".`);
  };

  const removeAll = () => {
    if (!window.confirm(`Remove all ${configs.length} saved config(s) from browser storage?`)) return;
    clearAll();
    onMessage('Cleared all saved configs.');
  };

  return (
    <aside
      style={{ width }}
      className={`relative flex h-full shrink-0 flex-col border-l border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40 ${
        dragWidth !== null ? 'select-none' : ''
      }`}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        className={`absolute inset-y-0 -left-0.5 z-10 w-1 cursor-col-resize hover:bg-blue-400 ${dragWidth !== null ? 'bg-blue-500' : ''}`}
      />

      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-gray-200 px-3 dark:border-gray-800">
        <h2 className="truncate text-sm font-semibold">Saved configs</h2>
        <span className="text-xs text-gray-400">({configs.length})</span>
        <button
          type="button"
          onClick={removeAll}
          disabled={configs.length === 0}
          className="toolbar-btn ml-auto text-xs hover:text-red-600 dark:hover:text-red-400"
          title="Remove all saved configs"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear all
        </button>
        <button type="button" onClick={() => setSidebarOpen(false)} className="toolbar-btn" title="Collapse sidebar">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sorted.length === 0 ? (
          <p className="p-3 text-center text-xs text-gray-400">No saved configs. Use "Save to browser" to keep the current steps here.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {sorted.map((config) => (
              <li
                key={config.id}
                className="rounded-md border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="truncate text-sm font-medium" title={config.name}>
                  {config.name}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{formatDateTime(config.savedAt)}</span>
                  <span>·</span>
                  <span>
                    {config.steps.length} {config.steps.length === 1 ? 'step' : 'steps'}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1">
                  <button type="button" onClick={() => onImport(config)} className="btn-secondary" title="Replace current steps with this config">
                    <Upload className="h-3.5 w-3.5" /> Import
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(config)}
                    className="toolbar-btn ml-auto text-xs hover:text-red-600 dark:hover:text-red-400"
                    title="Remove this saved config"
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
