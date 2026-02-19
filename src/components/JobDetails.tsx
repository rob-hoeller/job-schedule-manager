"use client";

import type { Job, Activity } from "@/types";
import { formatDate, dayDrift, driftClass, driftLabel } from "@/lib/utils";

interface Props {
  job: Job;
  settlement: Activity | null;
}

function Detail({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-500 dark:text-gray-400">{label}: </span>
      <span className="font-medium">{value}</span>
      {extra}
    </div>
  );
}

export function JobDetails({ job, settlement }: Props) {
  const settleDrift = settlement
    ? dayDrift(settlement.original_start_date, settlement.current_start_date)
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Detail label="Community" value={job.community_name} />
        <Detail label="Lot" value={job.lot_number} />
        <Detail label="Plan" value={job.plan_name ?? "—"} />
        <Detail label="Status" value={job.status} />
        <Detail label="Start" value={formatDate(job.start_date)} />
        <Detail
          label="Settlement"
          value={settlement ? formatDate(settlement.current_start_date) : "—"}
          extra={
            settleDrift !== null ? (
              <span className={`ml-1 text-xs font-medium ${driftClass(settleDrift)}`}>
                {driftLabel(settleDrift)}
              </span>
            ) : null
          }
        />
      </div>
    </div>
  );
}
