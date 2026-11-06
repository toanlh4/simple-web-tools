function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats an ISO timestamp in local time as `yyyy-mm-dd HH24:mi:ss`. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
}
