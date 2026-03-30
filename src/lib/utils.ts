/**
 * Parse date string (YYYY-MM-DD) as local date to avoid UTC timezone shift.
 * Use this instead of `new Date(dateString)` to prevent dates shifting by timezone offset.
 */
export function parseLocalDate(d: string): Date {
  const [year, month, day] = d.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(d: string | null) {
  if (!d) return "—";
  return parseLocalDate(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CURRENT_YEAR = new Date().getFullYear();

/** Format date, omitting year if it matches the current year */
export function formatDateCompact(d: string | null) {
  if (!d) return "—";
  const date = parseLocalDate(d);
  if (date.getFullYear() === CURRENT_YEAR) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const STATUS_STYLES: Record<string, string> = {
  Released: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export const STATUS_DOT: Record<string, string> = {
  Released: "bg-blue-500",
  Approved: "bg-green-500",
  Completed: "bg-gray-400",
};

export function statusClass(status: string) {
  return STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

/** Count workdays between two date strings (inclusive of start, exclusive of end).
 *  Uses calendarDays map for accurate holiday/workday data; falls back to Mon-Fri. */
export function countWorkdays(
  startDate: string | null,
  endDate: string | null,
  calendarDays?: Map<string, { is_workday: number }>,
): number | null {
  if (!startDate || !endDate) return null;
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 10);
    const cd = calendarDays?.get(key);
    const isWorkday = cd ? cd.is_workday === 1 : (cursor.getDay() !== 0 && cursor.getDay() !== 6);
    if (isWorkday) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Calculate workday drift between two date strings (positive = forward in time) */
export function dayDrift(original: string | null, current: string | null): number | null {
  if (!original || !current) return null;
  const a = parseLocalDate(original);
  const b = parseLocalDate(current);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff === 0 ? null : diff;
}

/** Format drift as a colored string component props */
export function driftClass(drift: number | null): string {
  if (drift === null) return "";
  return drift > 0 ? "text-red-500" : "text-green-500";
}

export function driftLabel(drift: number | null): string {
  if (drift === null) return "";
  return drift > 0 ? `+${drift}` : `${drift}`;
}
