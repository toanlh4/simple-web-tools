/** A heap space, sized from its hex addresses (the printed percentages are truncated). All values in bytes. */
export interface HeapSpace {
  /** Start address; survivor spaces swap positions after a GC, so this gives their real order. */
  bottom: number;
  capacity: number;
  used: number;
}

/** A generation's address range. All values in bytes. */
export interface Generation {
  committed: number;
  reserved: number;
}

/** A Metaspace line's values, in bytes. */
export interface NonHeapSpace {
  used: number;
  committed: number;
  reserved: number;
}

export interface HeapInfo {
  young: Generation;
  old: Generation;
  eden: HeapSpace;
  from: HeapSpace;
  to: HeapSpace;
  tenured: HeapSpace;
  metaspace: NonHeapSpace;
  /** Null when the JVM runs without compressed class pointers, which removes this line. */
  classSpace: NonHeapSpace | null;
}

export type ParseResult = { ok: true; info: HeapInfo } | { ok: false; error: string };

const SIZE = String.raw`(\d+)([KMG])`;
const ADDR = String.raw`(0x[0-9a-fA-F]+)`;
const SPACE_PREFIX = String.raw`\s+${SIZE},\s*\d+%\s*used\s*\[`;

const GENERATION_LINE = (label: string) =>
  new RegExp(String.raw`^\s*${label}\s+total\s+${SIZE},\s*used\s+${SIZE}\s*\[${ADDR},\s*${ADDR},\s*${ADDR}\)`, 'm');
const SPACE_LINE = (label: string) => new RegExp(String.raw`^\s*${label}${SPACE_PREFIX}${ADDR},\s*${ADDR},\s*${ADDR}\)`, 'm');
/** Tenured has an extra block-start address between its top and end. */
const TENURED_SPACE_LINE = new RegExp(String.raw`^\s*the\s+space${SPACE_PREFIX}${ADDR},\s*${ADDR},\s*${ADDR},\s*${ADDR}\)`, 'm');
/** JDK 8 also prints a `capacity` field. */
const NON_HEAP_LINE = (label: string) =>
  new RegExp(String.raw`^\s*${label}\s+used\s+${SIZE},(?:\s*capacity\s+\d+[KMG],)?\s*committed\s+${SIZE},\s*reserved\s+${SIZE}`, 'm');

const UNIT_BYTES: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };

const toBytes = (value: string, unit: string) => Number(value) * UNIT_BYTES[unit];
const toAddress = (hex: string) => parseInt(hex, 16);

function parseGeneration(match: RegExpMatchArray): Generation {
  const [low, high, end] = [match[5], match[6], match[7]].map(toAddress);
  return { committed: high - low, reserved: end - low };
}

function parseSpace(match: RegExpMatchArray): HeapSpace {
  // Space lines are [bottom, top, end); tenured's is [bottom, top, block start, end).
  const bottom = toAddress(match[3]);
  const top = toAddress(match[4]);
  const end = toAddress(match[match.length - 1]);
  return { bottom, capacity: end - bottom, used: top - bottom };
}

function parseNonHeap(match: RegExpMatchArray): NonHeapSpace {
  return {
    used: toBytes(match[1], match[2]),
    committed: toBytes(match[3], match[4]),
    reserved: toBytes(match[5], match[6]),
  };
}

/** Parses `jcmd <PID> GC.heap_info` output from a JVM using Serial GC. */
export function parseHeapInfo(text: string): ParseResult {
  const young = text.match(GENERATION_LINE('def new generation'));
  const old = text.match(GENERATION_LINE('tenured generation'));
  if (!young || !old) {
    return {
      ok: false,
      error: 'No Serial GC heap found. Only Serial GC output is supported: it needs the "def new generation" and "tenured generation" lines.',
    };
  }

  const eden = text.match(SPACE_LINE('eden\\s+space'));
  const from = text.match(SPACE_LINE('from\\s+space'));
  const to = text.match(SPACE_LINE('to\\s+space'));
  const tenured = text.match(TENURED_SPACE_LINE);
  const metaspace = text.match(NON_HEAP_LINE('Metaspace'));
  const classSpace = text.match(NON_HEAP_LINE('class\\s+space'));

  const missing = [
    !eden && 'eden space',
    !from && 'from space',
    !to && 'to space',
    !tenured && 'the space',
    !metaspace && 'Metaspace',
  ].filter(Boolean);
  if (!eden || !from || !to || !tenured || !metaspace) {
    return { ok: false, error: `The output looks incomplete. Missing line(s): ${missing.join(', ')}.` };
  }

  return {
    ok: true,
    info: {
      young: parseGeneration(young),
      old: parseGeneration(old),
      eden: parseSpace(eden),
      from: parseSpace(from),
      to: parseSpace(to),
      tenured: parseSpace(tenured),
      metaspace: parseNonHeap(metaspace),
      classSpace: classSpace ? parseNonHeap(classSpace) : null,
    },
  };
}

export const heapUsed = (info: HeapInfo) => info.eden.used + info.from.used + info.to.used + info.tenured.used;
export const heapCommitted = (info: HeapInfo) => info.young.committed + info.old.committed;
export const heapReserved = (info: HeapInfo) => info.young.reserved + info.old.reserved;

export function formatSize(bytes: number): string {
  if (bytes >= UNIT_BYTES.G) return `${(bytes / UNIT_BYTES.G).toFixed(2)} GB`;
  if (bytes >= UNIT_BYTES.M) return `${(bytes / UNIT_BYTES.M).toFixed(1)} MB`;
  return `${Math.round(bytes / UNIT_BYTES.K)} KB`;
}

export function formatPercent(part: number, whole: number): string {
  return `${(whole > 0 ? (part / whole) * 100 : 0).toFixed(1)}%`;
}
