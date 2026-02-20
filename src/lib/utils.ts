export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CURRENT_YEAR = new Date().getFullYear();

/** Format date, omitting year if it matches the current year */
export function formatDateCompact(d: string | null) {
  if (!d) return "—";
  const date = new Date(d);
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

/** Calculate workday drift between two date strings (positive = forward in time) */
export function dayDrift(original: string | null, current: string | null): number | null {
  if (!original || !current) return null;
  const a = new Date(original);
  const b = new Date(current);
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
