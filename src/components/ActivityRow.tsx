"use client";

import { useState } from "react";
import type { Activity, Dependency } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatDate, dayDrift, driftClass, driftLabel } from "@/lib/utils";

interface Props {
  activity: Activity;
  predecessors: Dependency[];
  successors: Dependency[];
  activityMap: Map<number, Activity>;
}

function Drift({ original, current }: { original: string | null; current: string | null }) {
  const drift = dayDrift(original, current);
  if (drift === null) return null;
  return <span className={`ml-1 text-xs font-medium ${driftClass(drift)}`}>{driftLabel(drift)}</span>;
}

function DurationDrift({ original, current }: { original: number | null; current: number | null }) {
  if (original == null || current == null || original === current) return null;
  const diff = current - original;
  const cls = diff > 0 ? "text-red-500" : "text-green-500";
  return <span className={`ml-1 text-xs font-medium ${cls}`}>{diff > 0 ? "+" : ""}{diff}</span>;
}

function hasDateChanges(a: Activity) {
  return (
    a.original_start_date !== a.current_start_date ||
    a.original_end_date !== a.current_end_date ||
    a.original_duration !== a.current_duration
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
              <span className="text-gray-500"> ({d.lag_days > 0 ? "+" : ""}{d.lag_days})</span>
            )}
            {" — "}
            <span>{linked?.description ?? `Activity ${d[labelRid]}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ActivityRow({ activity: a, predecessors, successors, activityMap }: Props) {
  const [open, setOpen] = useState(false);
  const changed = hasDateChanges(a);

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
          <Drift original={a.original_start_date} current={a.current_start_date} />
        </td>
        <td className="hidden px-3 py-2.5 text-sm md:table-cell">
          {formatDate(a.current_end_date)}
          <Drift original={a.original_end_date} current={a.current_end_date} />
        </td>
        <td className="hidden px-3 py-2.5 text-sm text-center lg:table-cell">
          {a.current_duration ?? "—"}
          <DurationDrift original={a.original_duration} current={a.current_duration} />
        </td>
      </tr>
      {open && (
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <td colSpan={6} className="bg-gray-50/50 px-6 py-3 dark:bg-gray-900/30">
            {/* Mobile: show fields hidden on small screens */}
            <div className="mb-3 space-y-1 text-sm sm:hidden">
              <p><span className="text-gray-500">Trade: </span>{a.trade_partner_name ?? "—"}</p>
            </div>
            <div className="mb-3 space-y-1 text-sm md:hidden">
              <p>
                <span className="text-gray-500">Start: </span>{formatDate(a.current_start_date)}
                <Drift original={a.original_start_date} current={a.current_start_date} />
              </p>
              <p>
                <span className="text-gray-500">End: </span>{formatDate(a.current_end_date)}
                <Drift original={a.original_end_date} current={a.current_end_date} />
              </p>
              <p>
                <span className="text-gray-500">Duration: </span>{a.current_duration ?? "—"} days
                <DurationDrift original={a.original_duration} current={a.current_duration} />
              </p>
            </div>
            {/* Original dates if changed */}
            {changed && (
              <div className="mb-3 rounded border border-gray-200 bg-white/50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/50">
                <p className="mb-1 font-semibold uppercase tracking-wide text-gray-500">Original Schedule</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {a.original_start_date !== a.current_start_date && (
                    <span><span className="text-gray-500">Start: </span>{formatDate(a.original_start_date)}</span>
                  )}
                  {a.original_end_date !== a.current_end_date && (
                    <span><span className="text-gray-500">End: </span>{formatDate(a.original_end_date)}</span>
                  )}
                  {a.original_duration !== a.current_duration && (
                    <span><span className="text-gray-500">Duration: </span>{a.original_duration} days</span>
                  )}
                </div>
              </div>
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
