export function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const STATUS_STYLES: Record<string, string> = {
  Released: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function statusClass(status: string) {
  return STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}
