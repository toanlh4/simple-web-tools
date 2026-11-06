import type { ReactElement } from 'react';
import { MemoryStick, Replace, type LucideIcon } from 'lucide-react';
import { HeapInfoPage } from './heap-info/HeapInfoPage';
import { ReplaceStringPage } from './replace-string/ReplaceStringPage';

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  path: string;
  element: ReactElement;
}

/** Every tool shown on the home page. Add new tools here. */
export const tools: ToolDef[] = [
  {
    id: 'replace-string',
    name: 'Replace String',
    description: 'Run a chain of plain-text or regex find/replace steps over a text. Reorder, disable and save steps as a config file.',
    icon: Replace,
    path: '/replace-string',
    element: <ReplaceStringPage />,
  },
  {
    id: 'heap-info',
    name: 'Heap Info',
    description: 'Turn jcmd GC.heap_info output from a Serial GC JVM into graphs showing the size and usage of each memory segment.',
    icon: MemoryStick,
    path: '/heap-info',
    element: <HeapInfoPage />,
  },
];
