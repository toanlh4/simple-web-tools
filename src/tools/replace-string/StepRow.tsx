import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { REGEX_FLAGS, type ReplaceStep, type StepKind, type StepResult } from './replace';
import { useReplaceStore } from './useReplaceStore';

interface StepRowProps {
  step: ReplaceStep;
  index: number;
  result: StepResult | undefined;
}

function ResultBadge({ result }: { result: StepResult | undefined }) {
  if (!result || result.status === 'error') return null;
  if (result.status === 'skipped') return <span className="text-[11px] text-gray-400">{result.reason}</span>;
  return (
    <span className={`text-[11px] ${result.matches > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
      {result.matches} {result.matches === 1 ? 'match' : 'matches'}
    </span>
  );
}

export function StepRow({ step, index, result }: StepRowProps) {
  const { updateStep, duplicateStep, removeStep } = useReplaceStore.getState();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const error = result?.status === 'error' ? result.message : null;

  const toggleFlag = (flag: string) => {
    const flags = step.flags.includes(flag) ? step.flags.replace(flag, '') : step.flags + flag;
    updateStep(step.id, { flags });
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`rounded-md border bg-white px-2 py-1.5 dark:bg-gray-900 ${
        isDragging ? 'relative z-10 border-blue-400 shadow-lg' : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          className="toolbar-btn cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          type="checkbox"
          checked={step.enabled}
          onChange={(e) => updateStep(step.id, { enabled: e.target.checked })}
          title={step.enabled ? 'Disable this step' : 'Enable this step'}
          className="h-3.5 w-3.5 accent-blue-600"
        />
        <span className="w-5 text-right text-xs tabular-nums text-gray-400">{index + 1}</span>

        <div className={`flex flex-1 flex-wrap items-center gap-2 ${step.enabled ? '' : 'opacity-50'}`}>
          <select
            value={step.kind}
            onChange={(e) => updateStep(step.id, { kind: e.target.value as StepKind })}
            className="input w-24 font-sans"
            title="Replace kind"
          >
            <option value="text">Text</option>
            <option value="regex">Regex</option>
          </select>
          <input
            value={step.find}
            onChange={(e) => updateStep(step.id, { find: e.target.value })}
            placeholder={step.kind === 'regex' ? 'Pattern, e.g. (\\d+)' : 'Old text'}
            className={`input min-w-40 flex-1 ${error ? 'input-error' : ''}`}
            spellCheck={false}
          />
          <span className="text-xs text-gray-400">→</span>
          <input
            value={step.replace}
            onChange={(e) => updateStep(step.id, { replace: e.target.value })}
            placeholder={step.kind === 'regex' ? 'Replacement, e.g. [$1]' : 'New text'}
            className="input min-w-40 flex-1"
            spellCheck={false}
          />
          {step.kind === 'regex' && (
            <div className="flex items-center gap-0.5" title="Regex flags">
              {REGEX_FLAGS.map(({ flag, title }) => (
                <button
                  key={flag}
                  type="button"
                  title={title}
                  onClick={() => toggleFlag(flag)}
                  className={`toolbar-btn h-6 min-w-6 font-mono text-xs ${step.flags.includes(flag) ? 'toolbar-btn-active' : 'text-gray-400'}`}
                >
                  {flag}
                </button>
              ))}
            </div>
          )}
          <span className="w-16">
            <ResultBadge result={result} />
          </span>
        </div>

        <button type="button" title="Duplicate step" onClick={() => duplicateStep(step.id)} className="toolbar-btn">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Delete step"
          onClick={() => removeStep(step.id)}
          className="toolbar-btn hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {error && <p className="mt-1 pl-16 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}
