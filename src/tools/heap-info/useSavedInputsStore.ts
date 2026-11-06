import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SavedInput {
  id: string;
  name: string;
  /** ISO timestamp of the last save. */
  savedAt: string;
  input: string;
}

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_DEFAULT_WIDTH = 300;

const normalizeName = (name: string) => name.trim().toLowerCase();
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

interface SavedInputsState {
  inputs: SavedInput[];
  sidebarOpen: boolean;
  sidebarWidth: number;
  findByName: (name: string) => SavedInput | undefined;
  /** Saves under `name`, overwriting an input with the same name (case-insensitive). */
  saveInput: (name: string, input: string) => void;
  removeInput: (id: string) => void;
  clearAll: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
}

/** Named heap_info outputs kept in this browser's localStorage, plus the sidebar's layout. */
export const useSavedInputsStore = create<SavedInputsState>()(
  persist(
    (set, get) => ({
      inputs: [],
      sidebarOpen: true,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      findByName: (name) => get().inputs.find((i) => normalizeName(i.name) === normalizeName(name)),
      saveInput: (name, input) => {
        const savedAt = new Date().toISOString();
        const existing = get().findByName(name);
        if (existing) {
          set((s) => ({ inputs: s.inputs.map((i) => (i.id === existing.id ? { ...i, name: name.trim(), savedAt, input } : i)) }));
        } else {
          set((s) => ({ inputs: [...s.inputs, { id: newId(), name: name.trim(), savedAt, input }] }));
        }
      },
      removeInput: (id) => set((s) => ({ inputs: s.inputs.filter((i) => i.id !== id) })),
      clearAll: () => set({ inputs: [] }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)) }),
    }),
    {
      name: 'simple-web-tools-heap-info-saved',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ inputs: s.inputs, sidebarOpen: s.sidebarOpen, sidebarWidth: s.sidebarWidth }),
    },
  ),
);
