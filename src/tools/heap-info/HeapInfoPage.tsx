import { useMemo, useState } from 'react';
import { BookmarkPlus, Eraser, FileText, PanelRight } from 'lucide-react';
import { formatPercent, formatSize, heapCommitted, heapReserved, heapUsed, parseHeapInfo, type HeapInfo } from './parse';
import { HeapMap } from './HeapMap';
import { SegmentUsage } from './SegmentUsage';
import { SavedInputsSidebar } from './SavedInputsSidebar';
import { SaveInputDialog } from './SaveInputDialog';
import { useSavedInputsStore, type SavedInput } from './useSavedInputsStore';

const SAMPLE = `Defaulted container "spark-kubernetes-driver" out of: spark-kubernetes-driver, pem-to-jks (init)
11:
 def new generation   total 114816K, used 21067K [0x00000000c7c00000, 0x00000000cf890000, 0x00000000da800000)
  eden space 102080K,  17% used [0x00000000c7c00000, 0x00000000c8df0c68, 0x00000000cdfb0000)
  from space 12736K,  21% used [0x00000000cdfb0000, 0x00000000ce252168, 0x00000000cec20000)
  to   space 12736K,   0% used [0x00000000cec20000, 0x00000000cec20000, 0x00000000cf890000)
 tenured generation   total 255016K, used 135020K [0x00000000da800000, 0x00000000ea10a000, 0x0000000100000000)
   the space 255016K,  52% used [0x00000000da800000, 0x00000000e2bdb270, 0x00000000e2bdb400, 0x00000000ea10a000)
 Metaspace       used 196744K, committed 198976K, reserved 1245184K
  class space    used 23493K, committed 24704K, reserved 1048576K
`;

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-0.5 text-xl font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{detail}</div>
    </div>
  );
}

function Results({ info }: { info: HeapInfo }) {
  const used = heapUsed(info);
  const committed = heapCommitted(info);
  const reserved = heapReserved(info);
  return (
    <div className="heap-viz flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Heap used"
          value={formatSize(used)}
          detail={`${formatPercent(used, committed)} of committed, ${formatPercent(used, reserved)} of max`}
        />
        <StatTile label="Heap committed" value={formatSize(committed)} detail={`${formatPercent(committed, reserved)} of max`} />
        <StatTile label="Max heap" value={formatSize(reserved)} detail={`Young ${formatSize(info.young.reserved)}, tenured ${formatSize(info.old.reserved)}`} />
        <StatTile
          label="Metaspace used"
          value={formatSize(info.metaspace.used)}
          detail={`${formatPercent(info.metaspace.used, info.metaspace.committed)} of committed`}
        />
      </section>

      <HeapMap info={info} />
      <SegmentUsage info={info} />

      <section className="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
        <p>
          Why these numbers can differ from the JVM's: percentages are computed from the hex addresses. The JVM cuts off the decimals, so a space it prints as
          17% can be 18.0% here.
        </p>
        <p>
          The JVM's young generation <code className="font-mono">total</code> counts Eden and From only. Committed memory here also includes the To space, so it is
          higher.
        </p>
      </section>
    </div>
  );
}

export function HeapInfoPage() {
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const sidebarOpen = useSavedInputsStore((s) => s.sidebarOpen);
  const { saveInput, findByName, setSidebarOpen } = useSavedInputsStore.getState();

  const parsed = useMemo(() => (input.trim() ? parseHeapInfo(input) : null), [input]);

  const saveToBrowser = (name: string) => {
    const existing = findByName(name);
    if (existing && !window.confirm(`A saved input named "${existing.name}" already exists. Overwrite it?`)) return;
    saveInput(name, input);
    setSaveDialogOpen(false);
    setSidebarOpen(true);
    setMessage({ kind: 'ok', text: `Saved input to browser as "${name}".` });
  };

  const importSaved = (saved: SavedInput) => {
    setInput(saved.input);
    setMessage({ kind: 'ok', text: `Imported saved input "${saved.name}".` });
  };

  const clearInput = () => {
    setInput('');
    setMessage(null);
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Input</h2>
              <span className="text-xs text-gray-400">
                Paste the output of <code className="font-mono">jcmd &lt;PID&gt; GC.heap_info</code> (Serial GC)
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSaveDialogOpen(true)}
                  className="btn-secondary"
                  disabled={!parsed?.ok}
                  title="Save this input to this browser's storage"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" /> Save to browser
                </button>
                <button type="button" onClick={() => setInput(SAMPLE)} className="btn-secondary" title="Fill the input with an example output">
                  <FileText className="h-3.5 w-3.5" /> Load sample
                </button>
                <button type="button" onClick={clearInput} className="btn-secondary" disabled={input.length === 0}>
                  <Eraser className="h-3.5 w-3.5" /> Clear
                </button>
                <span className="toolbar-sep" />
                <button
                  type="button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`toolbar-btn ${sidebarOpen ? 'toolbar-btn-active' : ''}`}
                  title={sidebarOpen ? 'Hide saved inputs' : 'Show saved inputs'}
                >
                  <PanelRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {message && (
              <p className={`text-xs ${message.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{message.text}</p>
            )}

            <div className="flex h-44">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste heap info here…"
                className="textarea"
                spellCheck={false}
                wrap="off"
              />
            </div>

            {parsed && !parsed.ok && <p className="text-xs text-red-600 dark:text-red-400">{parsed.error}</p>}
          </section>

          {parsed?.ok && <Results info={parsed.info} />}
        </div>
      </div>

      {sidebarOpen && <SavedInputsSidebar onImport={importSaved} onMessage={(text) => setMessage({ kind: 'ok', text })} />}

      {saveDialogOpen && <SaveInputDialog onSave={saveToBrowser} onClose={() => setSaveDialogOpen(false)} />}
    </div>
  );
}
