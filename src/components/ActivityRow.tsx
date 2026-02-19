"use client";

import { useState } from "react";
import type { Activity, Dependency } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils";

interface Props {
  activity: Activity;
  predecessors: Dependency[];
  successors: Dependency[];
  activityMap: Map<number, Activity>;
}

function datesChanged(a: Activity) {
  return (
    a.original_start_date !== a.current_start_date ||
    a.original_end_date !== a.current_end_date
  );
}

function DepList({
  deps,
  labelRid,
  activityMap,
}: {
  deps: Dependency[];
  labelRid: "predecessor_jsa_rid" | "successor_jsa_rid";
  activityMap: Map<number, Activity>;
}) {
  if (!deps.length) return <span className="text-gray-400 italic">None</span>;
  return (
    <ul className="space-y-0.5">
      {deps.map((d) => {
        const linked = activityMap.get(d[labelRid]);
        return (
          <li key={d.job_schedule_activity_dependency_id} className="text-xs">
            <span className="font-medium">{d.dependency_type}</span>
            {d.lag_days !== 0 && (
              <span className="text-gray-500"> ({d.lag_days > 0 ? "+" : ""}{d.lag_days}d)</span>
            )}
            {" — "}
            <span>{linked?.description ?? `RID ${d[labelRid]}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityRow({ activity: a, predecessors, successors, activityMap }: Props) {
  const [open, setOpen] = useState(false);
  const shifted = datesChanged(a);

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className="cursor-pointer border-b border-gray-100 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50"
      >
        <td className="px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className={`text-xs transition ${open ? "rotate-90" : ""}`}>▶</span>
            {a.description}
          </div>
        </td>
        <td className="hidden px-3 py-2.5 text-sm sm:table-cell">{a.trade_partner_name ?? "—"}</td>
        <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
        <td className="hidden px-3 py-2.5 text-sm md:table-cell">
          {formatDate(a.current_start_date)}
          {shifted && (
            <span className="ml-1 text-xs text-amber-500" title={`Was ${formatDate(a.original_start_date)}`}>⚠</span>
          )}
        </td>
        <td className="hidden px-3 py-2.5 text-sm md:table-cell">{formatDate(a.current_end_date)}</td>
        <td className="hidden px-3 py-2.5 text-sm text-center lg:table-cell">{a.current_duration ?? "—"}</td>
      </tr>
      {open && (
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <td colSpan={6} className="bg-gray-50/50 px-6 py-3 dark:bg-gray-900/30">
            {/* Mobile: show fields hidden on small screens */}
            <div className="mb-3 space-y-1 text-sm sm:hidden">
              <p><span className="text-gray-500">Trade: </span>{a.trade_partner_name ?? "—"}</p>
            </div>
            <div className="mb-3 space-y-1 text-sm md:hidden">
              <p><span className="text-gray-500">Start: </span>{formatDate(a.current_start_date)}</p>
              <p><span className="text-gray-500">End: </span>{formatDate(a.current_end_date)}</p>
              <p><span className="text-gray-500">Duration: </span>{a.current_duration ?? "—"} days</p>
            </div>
            {shifted && (
              <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                Original: {formatDate(a.original_start_date)} → {formatDate(a.original_end_date)} ({a.original_duration}d)
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Predecessors</p>
                <DepList deps={predecessors} labelRid="predecessor_jsa_rid" activityMap={activityMap} />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Successors</p>
                <DepList deps={successors} labelRid="successor_jsa_rid" activityMap={activityMap} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
