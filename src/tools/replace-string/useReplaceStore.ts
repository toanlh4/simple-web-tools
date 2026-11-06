import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import { createStep, type ReplaceStep } from './replace';

interface ReplaceState {
  input: string;
  steps: ReplaceStep[];
  setInput: (input: string) => void;
  addStep: () => void;
  updateStep: (id: string, patch: Partial<Omit<ReplaceStep, 'id'>>) => void;
  duplicateStep: (id: string) => void;
  removeStep: (id: string) => void;
  moveStep: (activeId: string, overId: string) => void;
  setSteps: (steps: ReplaceStep[]) => void;
}

/** Input text and steps survive reloads via localStorage (a convenience; config files are the durable way to keep steps). */
export const useReplaceStore = create<ReplaceState>()(
  persist(
    (set) => ({
      input: '',
      steps: [createStep()],
      setInput: (input) => set({ input }),
      addStep: () => set((s) => ({ steps: [...s.steps, createStep()] })),
      updateStep: (id, patch) => set((s) => ({ steps: s.steps.map((st) => (st.id === id ? { ...st, ...patch } : st)) })),
      duplicateStep: (id) =>
        set((s) => {
          const i = s.steps.findIndex((st) => st.id === id);
          if (i < 0) return s;
          const { id: _id, ...rest } = s.steps[i];
          const steps = [...s.steps];
          steps.splice(i + 1, 0, createStep(rest));
          return { steps };
        }),
      removeStep: (id) => set((s) => ({ steps: s.steps.filter((st) => st.id !== id) })),
      moveStep: (activeId, overId) =>
        set((s) => {
          const from = s.steps.findIndex((st) => st.id === activeId);
          const to = s.steps.findIndex((st) => st.id === overId);
          if (from < 0 || to < 0 || from === to) return s;
          return { steps: arrayMove(s.steps, from, to) };
        }),
      setSteps: (steps) => set({ steps }),
    }),
    {
      name: 'simple-web-tools-replace-string',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ input: s.input, steps: s.steps }),
    },
  ),
);
