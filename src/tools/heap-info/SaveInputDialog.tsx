import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

interface SaveInputDialogProps {
  onSave: (name: string) => void;
  onClose: () => void;
}

/** Local date time as `yyyy-mm-dd HH24:mi:ss`. */
function formatNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${date} ${time}`;
}

export function SaveInputDialog({ onSave, onClose }: SaveInputDialogProps) {
  // The dialog is mounted each time it opens, so this is the time the button was pressed.
  const [name, setName] = useState(formatNow);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]" onMouseDown={onClose}>
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center">
          <h2 className="text-sm font-semibold">Save to browser</h2>
          <button type="button" onClick={onClose} className="toolbar-btn ml-auto" title="Cancel (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Keeps the current input in this browser's storage. Saving with an existing name overwrites it.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Input name"
          className="input mt-3 w-full font-sans"
          maxLength={100}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
