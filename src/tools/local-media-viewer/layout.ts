import type { MediaGroup } from './media';

export const GAP = 4;
const MONTH_HEIGHT = 48;
const DAY_HEIGHT = 32;

export type Row =
  | { type: 'month'; group: MediaGroup }
  | { type: 'day'; group: MediaGroup }
  | { type: 'tiles'; group: MediaGroup; start: number; end: number };

export interface Layout {
  rows: Row[];
  /** Top of each row, plus the total height as the last entry. */
  offsets: number[];
  columns: number;
  /** Actual tile edge: the requested size stretched to fill the width. */
  tile: number;
}

export function buildLayout(groups: MediaGroup[], width: number, tileSize: number): Layout {
  const columns = Math.max(1, Math.floor((width + GAP) / (tileSize + GAP)));
  const tile = Math.max(1, Math.floor((width - GAP * (columns - 1)) / columns));
  const rows: Row[] = [];
  const offsets = [0];
  const push = (row: Row, height: number) => {
    rows.push(row);
    offsets.push(offsets[offsets.length - 1] + height);
  };
  let month: string | null | undefined;
  for (const group of groups) {
    if (group.month !== month) {
      push({ type: 'month', group }, MONTH_HEIGHT);
      month = group.month;
    }
    if (group.month !== null) push({ type: 'day', group }, DAY_HEIGHT);
    for (let start = group.start; start < group.end; start += columns) {
      push({ type: 'tiles', group, start, end: Math.min(start + columns, group.end) }, tile + GAP);
    }
  }
  return { rows, offsets, columns, tile };
}

/** Index of the row containing `y`, clamped to the existing rows (0 when there are none). */
export function findRow(offsets: number[], y: number): number {
  let low = 0;
  let high = Math.max(0, offsets.length - 2);
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid] <= y) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Row holding the item at this flat index, or -1. */
export function rowOfItem(rows: Row[], index: number): number {
  return rows.findIndex((r) => r.type === 'tiles' && index >= r.start && index < r.end);
}
