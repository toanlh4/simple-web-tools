import { formatPercent, formatSize, heapReserved, type HeapInfo } from './parse';
import { freeTint, SEGMENTS, type SegmentKey } from './segments';

interface UsageRowProps {
  segment: SegmentKey;
  used: number;
  capacity: number;
  capacityLabel?: string;
  note?: string;
}

function UsageRow({ segment, used, capacity, capacityLabel, note }: UsageRowProps) {
  const { name, color } = SEGMENTS[segment];
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-medium">{name}</span>
        <span className="font-semibold tabular-nums">{formatPercent(used, capacity)}</span>
        <span className="ml-auto text-gray-500 tabular-nums dark:text-gray-400">
          {formatSize(used)} / {formatSize(capacity)}
          {capacityLabel && ` ${capacityLabel}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: freeTint(color) }}>
        <div className="h-full rounded-full" style={{ width: `${capacity > 0 ? (used / capacity) * 100 : 0}%`, backgroundColor: color }} />
      </div>
      {note && <div className="text-[11px] text-gray-500 dark:text-gray-400">{note}</div>}
    </li>
  );
}

interface TableRow {
  name: string;
  used: number | null;
  capacity: number;
  /** Whether a share of the max heap applies; false for memory outside the heap. */
  heapShare: boolean;
}

const CELL = 'px-2 py-1.5 text-right whitespace-nowrap tabular-nums';

export function SegmentUsage({ info }: { info: HeapInfo }) {
  const total = heapReserved(info);
  const { eden, from, to, tenured, metaspace, classSpace } = info;

  const tableRows: TableRow[] = [
    { name: SEGMENTS.eden.name, used: eden.used, capacity: eden.capacity, heapShare: true },
    { name: SEGMENTS.from.name, used: from.used, capacity: from.capacity, heapShare: true },
    { name: SEGMENTS.to.name, used: to.used, capacity: to.capacity, heapShare: true },
    { name: 'Young, uncommitted', used: null, capacity: info.young.reserved - info.young.committed, heapShare: true },
    { name: SEGMENTS.tenured.name, used: tenured.used, capacity: tenured.capacity, heapShare: true },
    { name: 'Tenured, uncommitted', used: null, capacity: info.old.reserved - info.old.committed, heapShare: true },
    { name: SEGMENTS.metaspace.name, used: metaspace.used, capacity: metaspace.committed, heapShare: false },
    ...(classSpace ? [{ name: SEGMENTS.class.name, used: classSpace.used, capacity: classSpace.committed, heapShare: false }] : []),
  ];

  return (
    <>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">Heap usage by segment</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Percent of each segment's current capacity.</p>
          </div>
          <ul className="flex flex-col gap-3">
            <UsageRow segment="eden" used={eden.used} capacity={eden.capacity} />
            <UsageRow segment="from" used={from.used} capacity={from.capacity} />
            <UsageRow segment="to" used={to.used} capacity={to.capacity} />
            <UsageRow segment="tenured" used={tenured.used} capacity={tenured.capacity} />
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">Non-heap usage</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Percent of committed memory. This memory is outside the heap.</p>
          </div>
          <ul className="flex flex-col gap-3">
            <UsageRow
              segment="metaspace"
              used={metaspace.used}
              capacity={metaspace.committed}
              capacityLabel="committed"
              note={`${formatSize(metaspace.reserved)} reserved`}
            />
            {classSpace && (
              <UsageRow
                segment="class"
                used={classSpace.used}
                capacity={classSpace.committed}
                capacityLabel="committed"
                note={`${formatSize(classSpace.reserved)} reserved. Part of Metaspace, not added to it.`}
              />
            )}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Values</h2>
        <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Segment</th>
                <th className={`${CELL} font-medium`}>Used</th>
                <th className={`${CELL} font-medium`}>Capacity</th>
                <th className={`${CELL} font-medium`}>% used</th>
                <th className={`${CELL} font-medium`}>% of max heap</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.name} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800/60">
                  <td className="px-2 py-1.5 whitespace-nowrap">{row.name}</td>
                  <td className={CELL}>{row.used === null ? '–' : formatSize(row.used)}</td>
                  <td className={CELL}>{formatSize(row.capacity)}</td>
                  <td className={CELL}>{row.used === null ? '–' : formatPercent(row.used, row.capacity)}</td>
                  <td className={CELL}>{row.heapShare ? formatPercent(row.capacity, total) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
