import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowDownToLine, BookmarkPlus, Check, ClipboardCopy, Download, Eraser, PanelRight, Plus, Upload } from 'lucide-react';
import { applySteps, createStep } from './replace';
import { downloadText, parseConfig, serializeConfig, toStepData } from './config';
import { useReplaceStore } from './useReplaceStore';
import { useSavedConfigsStore, type SavedConfig } from './useSavedConfigsStore';
import { StepRow } from './StepRow';
import { SaveConfigDialog } from './SaveConfigDialog';
import { SavedConfigsSidebar } from './SavedConfigsSidebar';

export function ReplaceStringPage() {
  const input = useReplaceStore((s) => s.input);
  const steps = useReplaceStore((s) => s.steps);
  const { setInput, addStep, moveStep, setSteps } = useReplaceStore.getState();
  const sidebarOpen = useSavedConfigsStore((s) => s.sidebarOpen);
  const { saveConfig, findByName, setSidebarOpen } = useSavedConfigsStore.getState();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { output, results } = useMemo(() => applySteps(input, steps), [input, steps]);
  const enabledCount = steps.filter((s) => s.enabled).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) moveStep(String(active.id), String(over.id));
  };

  const exportConfig = () => {
    downloadText('replace-config.json', serializeConfig(steps));
    setMessage({ kind: 'ok', text: `Exported ${steps.length} step(s) to replace-config.json.` });
  };

  const importConfigFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const loaded = parseConfig(await file.text());
      setSteps(loaded);
      setMessage({ kind: 'ok', text: `Imported ${loaded.length} step(s) from ${file.name}.` });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const saveToBrowser = (name: string) => {
    const existing = findByName(name);
    if (existing && !window.confirm(`A saved config named "${existing.name}" already exists. Overwrite it?`)) return;
    saveConfig(name, toStepData(steps));
    setSaveDialogOpen(false);
    setSidebarOpen(true);
    setMessage({ kind: 'ok', text: `Saved ${steps.length} step(s) to browser as "${name}".` });
  };

  const importSaved = (config: SavedConfig) => {
    setSteps(config.steps.map((step) => createStep(step)));
    setMessage({ kind: 'ok', text: `Imported ${config.steps.length} step(s) from saved config "${config.name}".` });
  };

  const clearSteps = () => {
    if (steps.length > 0 && !window.confirm('Remove all steps?')) return;
    setSteps([]);
    setMessage(null);
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Steps</h2>
              <span className="text-xs text-gray-400">
                {enabledCount}/{steps.length} enabled · applied top to bottom
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSaveDialogOpen(true)} className="btn-secondary" title="Save steps to this browser's storage">
                  <BookmarkPlus className="h-3.5 w-3.5" /> Save to browser
                </button>
                <button type="button" onClick={exportConfig} className="btn-secondary" title="Download steps as a JSON config file">
                  <Download className="h-3.5 w-3.5" /> Export config
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary" title="Import steps from a JSON config file">
                  <Upload className="h-3.5 w-3.5" /> Import config
                </button>
                <button type="button" onClick={clearSteps} className="btn-secondary" disabled={steps.length === 0}>
                  <Eraser className="h-3.5 w-3.5" /> Clear
                </button>
                <input ref={fileRef} type="file" accept=".json,application/json" onChange={importConfigFile} className="hidden" />
                <span className="toolbar-sep" />
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`toolbar-btn ${sidebarOpen ? 'toolbar-btn-active' : ''}`}
                  title={sidebarOpen ? 'Hide saved configs' : 'Show saved configs'}
                >
                  <PanelRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {message && (
              <p className={`text-xs ${message.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {message.text}
              </p>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-1.5">
                  {steps.map((step, i) => (
                    <StepRow key={step.id} step={step} index={i} result={results[i]} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            {steps.length === 0 && (
              <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-xs text-gray-400 dark:border-gray-700">
                No steps yet. Add one to start replacing.
              </p>
            )}
            <div>
              <button type="button" onClick={addStep} className="btn-primary">
                <Plus className="h-3.5 w-3.5" /> Add step
              </button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="flex h-96 flex-col gap-1.5">
              <div className="flex h-7 items-center gap-2">
                <h2 className="text-sm font-semibold">Input</h2>
                <span className="text-xs text-gray-400">{input.length} chars</span>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste text here…"
                className="textarea"
                spellCheck={false}
              />
            </div>
            <div className="flex h-96 flex-col gap-1.5">
              <div className="flex h-7 items-center gap-2">
                <h2 className="text-sm font-semibold">Output</h2>
                <span className="text-xs text-gray-400">{output.length} chars</span>
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => setInput(output)} className="toolbar-btn text-xs" title="Use output as the new input">
                    <ArrowDownToLine className="h-3.5 w-3.5 rotate-90" /> Use as input
                  </button>
                  <button type="button" onClick={copyOutput} className="toolbar-btn text-xs" title="Copy output to clipboard">
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <textarea value={output} readOnly className="textarea bg-gray-50 dark:bg-gray-900/60" spellCheck={false} />
            </div>
          </section>
        </div>
      </div>

      {sidebarOpen && <SavedConfigsSidebar onImport={importSaved} onMessage={(text) => setMessage({ kind: 'ok', text })} />}

      {saveDialogOpen && (
        <SaveConfigDialog stepCount={steps.length} onSave={saveToBrowser} onClose={() => setSaveDialogOpen(false)} />
      )}
    </div>
  );
}
