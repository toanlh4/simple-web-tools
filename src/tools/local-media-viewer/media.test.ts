import { describe, expect, it } from 'vitest';
import { countMonths, dayLabel, groupItems, kindOf, monthLabel, parseDate, sortItems, toMediaItem, type MediaItem } from './media';

function items(paths: string[], root = 'Media'): MediaItem[] {
  return paths.map((p) => toMediaItem(root, p)).filter((i) => i !== null);
}

describe('parseDate', () => {
  it('reads month and day folders', () => {
    expect(parseDate(['Media', '2019', '2019-10', '21'])).toEqual({ month: '2019-10', day: 21 });
    expect(parseDate(['Media', '2019', '2019-10'])).toEqual({ month: '2019-10', day: null });
    expect(parseDate(['Media', '2019'])).toEqual({ month: null, day: null });
  });
  it('rejects impossible months and days', () => {
    expect(parseDate(['2019-13', '01'])).toEqual({ month: null, day: null });
    expect(parseDate(['2023-02', '29'])).toEqual({ month: '2023-02', day: null });
    expect(parseDate(['2024-02', '29'])).toEqual({ month: '2024-02', day: 29 });
    expect(parseDate(['2024-02', '00'])).toEqual({ month: '2024-02', day: null });
    expect(parseDate(['2024-02', 'trip', '03'])).toEqual({ month: '2024-02', day: null });
  });
  it("uses the picked folder's own name", () => {
    expect(toMediaItem('2019-10', '21/a.jpg')).toMatchObject({ month: '2019-10', day: 21 });
    expect(toMediaItem('2019-10', 'a.jpg')).toMatchObject({ month: '2019-10', day: null });
    expect(toMediaItem('21', 'a.jpg')).toMatchObject({ month: null, day: null });
  });
});

describe('kindOf', () => {
  it('accepts supported formats in any case and skips others', () => {
    expect(kindOf('A.JPG')).toBe('photo');
    expect(kindOf('a.b.MOV')).toBe('video');
    for (const name of ['a.heic', 'a.zip', 'jpg', '.jpg', 'a.constructor']) expect(kindOf(name)).toBeNull();
  });
});

describe('ordering', () => {
  const list = items([
    'loose.jpg',
    '2020/2020-01/z.jpg',
    '2020/2020-01/02/IMG_10.jpg',
    '2020/2020-01/02/IMG_2.jpg',
    '2020/2020-01/10/a.mp4',
    '2019/2019-12/31/a.jpg',
  ]);
  it('sorts newest first with names ascending', () => {
    expect(sortItems(list, 'newest').map((i) => i.path)).toEqual([
      '2020/2020-01/10/a.mp4',
      '2020/2020-01/02/IMG_2.jpg',
      '2020/2020-01/02/IMG_10.jpg',
      '2020/2020-01/z.jpg',
      '2019/2019-12/31/a.jpg',
      'loose.jpg',
    ]);
  });
  it('keeps "No day" and "Undated" last when oldest first', () => {
    expect(sortItems(list, 'oldest').map((i) => i.path)).toEqual([
      '2019/2019-12/31/a.jpg',
      '2020/2020-01/02/IMG_2.jpg',
      '2020/2020-01/02/IMG_10.jpg',
      '2020/2020-01/10/a.mp4',
      '2020/2020-01/z.jpg',
      'loose.jpg',
    ]);
  });
  it('groups by day and counts by month', () => {
    const groups = groupItems(sortItems(list, 'newest'));
    expect(groups.map((g) => [g.key, g.start, g.end])).toEqual([
      ['2020-01/10', 0, 1],
      ['2020-01/2', 1, 3],
      ['2020-01/', 3, 4],
      ['2019-12/31', 4, 5],
      ['undated/', 5, 6],
    ]);
    expect(countMonths(groups)).toEqual([
      { month: '2020-01', count: 4 },
      { month: '2019-12', count: 1 },
      { month: null, count: 1 },
    ]);
  });
});

it('labels dates without timezone shifts', () => {
  expect(monthLabel('2019-10')).toBe('October 2019');
  expect(dayLabel('2019-10', 21)).toBe('2019-10-21 Monday');
  expect(dayLabel('2019-10', null)).toBe('No day');
  expect(monthLabel(null)).toBe('Undated');
});
