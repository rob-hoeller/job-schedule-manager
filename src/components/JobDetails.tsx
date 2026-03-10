"use client";

import { useState } from "react";
import type { Job, Activity } from "@/types";
import { formatDateCompact, dayDrift, driftClass, driftLabel } from "@/lib/utils";

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
  const [expanded, setExpanded] = useState(false);

  const settleDrift = settlement
    ? dayDrift(settlement.original_start_date, settlement.current_start_date)
    : null;

  const settlementExtra = settleDrift !== null ? (
    <span className={`ml-1 text-xs font-medium ${driftClass(settleDrift)}`}>
      {driftLabel(settleDrift)}
    </span>
  ) : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
      {/* Mobile: compact with expand toggle */}
      <div className="sm:hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
            <Detail label="Start" value={formatDateCompact(job.start_date)} />
            <Detail
              label="Settlement"
              value={settlement ? formatDateCompact(settlement.current_start_date) : "—"}
              extra={settlementExtra}
            />
          </div>
          <span className={`text-xs text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
        </button>
        {expanded && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
            <Detail label="Community" value={job.community_name} />
            <Detail label="Lot" value={job.lot_number} />
            <Detail label="Plan" value={job.plan_name ?? "—"} />
            <Detail label="Status" value={job.status} />
          </div>
        )}
      </div>

      {/* Desktop: full grid always visible */}
      <div className="hidden p-4 sm:block">
        <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Detail label="Community" value={job.community_name} />
          <Detail label="Lot" value={job.lot_number} />
          <Detail label="Plan" value={job.plan_name ?? "—"} />
          <Detail label="Status" value={job.status} />
          <Detail label="Start" value={formatDateCompact(job.start_date)} />
          <Detail
            label="Settlement"
            value={settlement ? formatDateCompact(settlement.current_start_date) : "—"}
            extra={settlementExtra}
          />
        </div>
      </div>
    </div>
  );
}
