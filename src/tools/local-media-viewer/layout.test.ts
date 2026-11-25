import { describe, expect, it } from 'vitest';
import { buildLayout, findRow, rowOfItem } from './layout';
import type { MediaGroup } from './media';

const groups: MediaGroup[] = [
  { key: 'a', month: '2020-01', day: 2, start: 0, end: 5 },
  { key: 'b', month: '2020-01', day: null, start: 5, end: 6 },
  { key: 'c', month: null, day: null, start: 6, end: 7 },
];

describe('buildLayout', () => {
  // 3 columns of 100px with 4px gaps.
  const layout = buildLayout(groups, 308, 100);
  it('lays out headers and tile rows', () => {
    expect(layout).toMatchObject({ columns: 3, tile: 100 });
    expect(layout.rows.map((r) => r.type)).toEqual(['month', 'day', 'tiles', 'tiles', 'day', 'tiles', 'month', 'tiles']);
    expect(layout.offsets).toEqual([0, 48, 80, 184, 288, 320, 424, 472, 576]);
  });
  it('finds rows by position, clamped', () => {
    expect([-5, 0, 47, 48, 183, 184, 9999].map((y) => findRow(layout.offsets, y))).toEqual([0, 0, 0, 1, 2, 3, 7]);
    expect(findRow([0], 10)).toBe(0);
  });
  it('finds rows by item', () => {
    expect([0, 2, 3, 5, 6, 7].map((i) => rowOfItem(layout.rows, i))).toEqual([2, 2, 3, 5, 7, -1]);
  });
  it('always has one column', () => {
    expect(buildLayout(groups, 50, 100)).toMatchObject({ columns: 1, tile: 50 });
  });
});
