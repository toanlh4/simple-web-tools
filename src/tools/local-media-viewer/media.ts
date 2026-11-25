export type MediaKind = 'photo' | 'video';
export type SortOrder = 'newest' | 'oldest';
export type KindFilter = 'all' | MediaKind;

export interface MediaItem {
  /** Path relative to the picked folder, with `/` separators. */
  path: string;
  name: string;
  dir: string;
  kind: MediaKind;
  /** `YYYY-MM`, or null when no date can be read from the path. */
  month: string | null;
  /** Day of month, or null for files that are not in a day folder. */
  day: number | null;
}

export interface MediaGroup {
  key: string;
  month: string | null;
  day: number | null;
  /** Index of the first item in the flat, sorted item list. */
  start: number;
  /** Index after the last item. */
  end: number;
}

const KINDS: Record<string, MediaKind> = {
  jpg: 'photo',
  jpeg: 'photo',
  png: 'photo',
  gif: 'photo',
  webp: 'photo',
  avif: 'photo',
  bmp: 'photo',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  m4v: 'video',
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function kindOf(name: string): MediaKind | null {
  const ext = extensionOf(name);
  return Object.hasOwn(KINDS, ext) ? KINDS[ext] : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Reads the date from folder names: the deepest `YYYY-MM` folder and the `DD` folder directly inside it. */
export function parseDate(folders: string[]): { month: string | null; day: number | null } {
  for (let i = folders.length - 1; i >= 0; i--) {
    const match = /^(\d{4})-(\d{2})$/.exec(folders[i]);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) continue;
    const next = folders[i + 1];
    const day = next !== undefined && /^\d{2}$/.test(next) ? Number(next) : 0;
    return { month: folders[i], day: day >= 1 && day <= daysInMonth(year, month) ? day : null };
  }
  return { month: null, day: null };
}

/** Returns null for files that are not a supported photo or video. */
export function toMediaItem(rootName: string, path: string): MediaItem | null {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  const kind = kindOf(name);
  if (!kind) return null;
  const folders = segments.slice(0, -1);
  return { path, name, dir: folders.join('/'), kind, ...parseDate([rootName, ...folders]) };
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Months and days follow `order`; "No day" ends its month, "Undated" ends the list, and names are always ascending. */
export function sortItems(items: MediaItem[], order: SortOrder): MediaItem[] {
  const sign = order === 'newest' ? -1 : 1;
  return [...items].sort((a, b) => {
    if (a.month !== b.month) {
      if (a.month === null) return 1;
      if (b.month === null) return -1;
      return a.month < b.month ? -sign : sign;
    }
    if (a.day !== b.day) {
      if (a.day === null) return 1;
      if (b.day === null) return -1;
      return (a.day - b.day) * sign;
    }
    return (a.dir === b.dir ? 0 : collator.compare(a.dir, b.dir)) || collator.compare(a.name, b.name) || (a.path < b.path ? -1 : 1);
  });
}

/** Splits sorted items into one group per day, "No day" or "Undated". */
export function groupItems(sorted: MediaItem[]): MediaGroup[] {
  const groups: MediaGroup[] = [];
  sorted.forEach((item, i) => {
    const last = groups[groups.length - 1];
    if (last && last.month === item.month && last.day === item.day) {
      last.end = i + 1;
    } else {
      groups.push({ key: `${item.month ?? 'undated'}/${item.day ?? ''}`, month: item.month, day: item.day, start: i, end: i + 1 });
    }
  });
  return groups;
}

export interface MonthCount {
  month: string | null;
  count: number;
}

/** Item count per month, in timeline order. */
export function countMonths(groups: MediaGroup[]): MonthCount[] {
  const months: MonthCount[] = [];
  for (const g of groups) {
    const last = months[months.length - 1];
    if (last && last.month === g.month) last.count += g.end - g.start;
    else months.push({ month: g.month, count: g.end - g.start });
  }
  return months;
}

const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortMonthFormat = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' });

function utcDate(month: string, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, day);
  return date;
}

export function monthLabel(month: string | null): string {
  return month === null ? 'Undated' : monthFormat.format(utcDate(month, 1));
}

export function shortMonthLabel(month: string): string {
  return shortMonthFormat.format(utcDate(month, 1));
}

/** Empty for undated items, which only have a month-level header. */
export function dayLabel(month: string | null, day: number | null): string {
  if (month === null) return '';
  if (day === null) return 'No day';
  return `${month}-${String(day).padStart(2, '0')} ${weekdayFormat.format(utcDate(month, day))}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
