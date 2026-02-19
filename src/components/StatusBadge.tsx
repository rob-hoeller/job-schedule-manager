import { statusClass } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(status)}`}>
      {status}
    </span>
  );
}
