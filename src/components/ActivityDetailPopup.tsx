"use client";

import type { Activity, Dependency } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatDate, dayDrift, driftClass, driftLabel } from "@/lib/utils";

interface Props {
  activity: Activity;
  predecessors: Dependency[];
  successors: Dependency[];
  activityMap: Map<number, Activity>;
  onClose: () => void;
}

function DepList({ deps, ridKey, activityMap }: {
  deps: Dependency[];
  ridKey: "predecessor_jsa_rid" | "successor_jsa_rid";
  activityMap: Map<number, Activity>;
}) {
  const resolved = deps.filter((d) => activityMap.has(d[ridKey]));
  if (!resolved.length) return <span className="text-xs text-gray-400 italic">None</span>;
  return (
    <ul className="space-y-0.5">
      {resolved.map((d) => (
        <li key={d.job_schedule_activity_dependency_id} className="text-xs">
          <span className="font-medium">{d.dependency_type}</span>
          {d.lag_days !== 0 && (
            <span className="text-gray-500"> ({d.lag_days > 0 ? "+" : ""}{d.lag_days})</span>
          )}
          {" — "}{activityMap.get(d[ridKey])!.description}
        </li>
      ))}
    </ul>
  );
}

export function ActivityDetailPopup({ activity: a, predecessors, successors, activityMap, onClose }: Props) {
  const startDrift = dayDrift(a.original_start_date, a.current_start_date);
  const endDrift = dayDrift(a.original_end_date, a.current_end_date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold">{a.description}</h3>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="text-gray-500">Trade: </span>{a.trade_partner_name ?? "—"}</p>
          <p><span className="text-gray-500">Status: </span><StatusBadge status={a.status} /></p>
          <p>
            <span className="text-gray-500">Start: </span>{formatDate(a.current_start_date)}
            {startDrift !== null && <span className={`ml-1 text-xs font-medium ${driftClass(startDrift)}`}>{driftLabel(startDrift)}</span>}
          </p>
          <p>
            <span className="text-gray-500">End: </span>{formatDate(a.current_end_date)}
            {endDrift !== null && <span className={`ml-1 text-xs font-medium ${driftClass(endDrift)}`}>{driftLabel(endDrift)}</span>}
          </p>
          <p><span className="text-gray-500">Duration: </span>{a.current_duration ?? "—"} days</p>
        </div>

        {/* Original schedule if changed */}
        {(a.original_start_date !== a.current_start_date || a.original_end_date !== a.current_end_date) && (
          <div className="mt-3 rounded border border-gray-200 bg-white/50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
            <p className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Original Schedule</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {a.original_start_date !== a.current_start_date && (
                <span><span className="text-gray-500">Start: </span>{formatDate(a.original_start_date)}</span>
              )}
              {a.original_end_date !== a.current_end_date && (
                <span><span className="text-gray-500">End: </span>{formatDate(a.original_end_date)}</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Predecessors</p>
            <DepList deps={predecessors} ridKey="predecessor_jsa_rid" activityMap={activityMap} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Successors</p>
            <DepList deps={successors} ridKey="successor_jsa_rid" activityMap={activityMap} />
          </div>
        </div>
      </div>
    </div>
  );
}
