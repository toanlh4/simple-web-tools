import type { HeapInfo, HeapSpace } from './parse';

export type SegmentKey = 'eden' | 'from' | 'to' | 'tenured' | 'metaspace' | 'class' | 'uncommitted';

interface SegmentMeta {
  name: string;
  /** CSS colors from the `.heap-viz` tokens in index.css. */
  color: string;
  /** Text color for a label set inside `color`. */
  onColor: string;
}

/** A segment keeps its color in every graph. */
export const SEGMENTS: Record<SegmentKey, SegmentMeta> = {
  eden: { name: 'Eden', color: 'var(--heap-eden)', onColor: '#ffffff' },
  from: { name: 'From', color: 'var(--heap-from)', onColor: '#ffffff' },
  to: { name: 'To', color: 'var(--heap-to)', onColor: '#ffffff' },
  tenured: { name: 'Tenured', color: 'var(--heap-tenured)', onColor: 'var(--heap-on-tenured)' },
  metaspace: { name: 'Metaspace', color: 'var(--heap-metaspace)', onColor: '#ffffff' },
  class: { name: 'Class space', color: 'var(--heap-class)', onColor: '#ffffff' },
  uncommitted: { name: 'Uncommitted', color: 'var(--heap-uncommitted)', onColor: 'inherit' },
};

/** The tint of a segment's hue shown for its unused part. */
export const freeTint = (color: string) => `color-mix(in srgb, ${color} 25%, transparent)`;

export interface HeapBlock {
  id: string;
  key: SegmentKey;
  name: string;
  size: number;
  used: number;
  committed: boolean;
}

const spaceBlock = (key: SegmentKey, space: HeapSpace): HeapBlock => ({
  id: key,
  key,
  name: SEGMENTS[key].name,
  size: space.capacity,
  used: space.used,
  committed: true,
});

const uncommittedBlock = (id: string, name: string, size: number): HeapBlock => ({
  id,
  key: 'uncommitted',
  name,
  size,
  used: 0,
  committed: false,
});

/** The whole reserved heap in address order. Empty blocks are left out. */
export function buildHeapBlocks(info: HeapInfo): HeapBlock[] {
  const survivors = [spaceBlock('from', info.from), spaceBlock('to', info.to)];
  if (info.to.bottom < info.from.bottom) survivors.reverse();
  return [
    spaceBlock('eden', info.eden),
    ...survivors,
    uncommittedBlock('young-uncommitted', 'Young, uncommitted', info.young.reserved - info.young.committed),
    spaceBlock('tenured', info.tenured),
    uncommittedBlock('old-uncommitted', 'Tenured, uncommitted', info.old.reserved - info.old.committed),
  ].filter((block) => block.size > 0);
}
