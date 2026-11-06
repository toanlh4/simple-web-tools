import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { newStepId, type StepData } from './replace';

export interface SavedConfig {
  id: string;
  name: string;
  /** ISO timestamp of the last save. */
  savedAt: string;
  steps: StepData[];
}

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_DEFAULT_WIDTH = 300;

const normalizeName = (name: string) => name.trim().toLowerCase();

interface SavedConfigsState {
  configs: SavedConfig[];
  sidebarOpen: boolean;
  sidebarWidth: number;
  findByName: (name: string) => SavedConfig | undefined;
  /** Saves under `name`, overwriting a config with the same name (case-insensitive). */
  saveConfig: (name: string, steps: StepData[]) => void;
  removeConfig: (id: string) => void;
  clearAll: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
}

/** Named step configs kept in this browser's localStorage, plus the sidebar's layout. */
export const useSavedConfigsStore = create<SavedConfigsState>()(
  persist(
    (set, get) => ({
      configs: [],
      sidebarOpen: true,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      findByName: (name) => get().configs.find((c) => normalizeName(c.name) === normalizeName(name)),
      saveConfig: (name, steps) => {
        const savedAt = new Date().toISOString();
        const existing = get().findByName(name);
        if (existing) {
          set((s) => ({ configs: s.configs.map((c) => (c.id === existing.id ? { ...c, name: name.trim(), savedAt, steps } : c)) }));
        } else {
          set((s) => ({ configs: [...s.configs, { id: newStepId(), name: name.trim(), savedAt, steps }] }));
        }
      },
      removeConfig: (id) => set((s) => ({ configs: s.configs.filter((c) => c.id !== id) })),
      clearAll: () => set({ configs: [] }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)) }),
    }),
    {
      name: 'simple-web-tools-replace-string-saved',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ configs: s.configs, sidebarOpen: s.sidebarOpen, sidebarWidth: s.sidebarWidth }),
    },
  ),
);
