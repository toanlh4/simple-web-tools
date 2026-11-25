import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { KindFilter, SortOrder } from './media';

export const TILE_MIN = 80;
export const TILE_MAX = 320;

interface PrefsState {
  order: SortOrder;
  filter: KindFilter;
  tileSize: number;
  sidebarOpen: boolean;
  setOrder: (order: SortOrder) => void;
  setFilter: (filter: KindFilter) => void;
  setTileSize: (size: number) => void;
  setSidebarOpen: (open: boolean) => void;
}

/** Display settings kept in localStorage. */
export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      order: 'newest',
      filter: 'all',
      tileSize: 160,
      sidebarOpen: true,
      setOrder: (order) => set({ order }),
      setFilter: (filter) => set({ filter }),
      setTileSize: (tileSize) => set({ tileSize }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    { name: 'simple-web-tools-local-media-viewer', storage: createJSONStorage(() => localStorage) },
  ),
);
