"use client";

import { useState } from "react";
import type { Activity, Dependency } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatDate, formatDateCompact, dayDrift, driftClass, driftLabel, STATUS_DOT } from "@/lib/utils";

import type { StagedChange } from "@/hooks/useStaging";

interface Props {
  activity: Activity;
  predecessors: Dependency[];
  successors: Dependency[];
  activityMap: Map<number, Activity>;
  onEditClick?: (activity: Activity) => void;
  isStaged?: boolean;
  isCascaded?: boolean;
  stagedFields?: Map<string, StagedChange>;
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
  const resolved = deps.filter((d) => activityMap.has(d[labelRid]));
  if (!resolved.length) return <span className="text-gray-400 italic">None</span>;
  return (
    <ul className="space-y-0.5">
      {resolved.map((d) => (
        <li key={d.job_schedule_activity_dependency_id} className="text-xs">
          <span className="font-medium">{d.dependency_type}</span>
          {d.lag_days !== 0 && (
            <span className="text-gray-500"> ({d.lag_days > 0 ? "+" : ""}{d.lag_days})</span>
          )}
          {" — "}
          <span>{activityMap.get(d[labelRid])!.description}</span>
        </li>
      ))}
    </ul>
  );
}

export function ActivityRow({ activity: a, predecessors, successors, activityMap, onEditClick, isStaged, isCascaded, stagedFields }: Props) {
  const [open, setOpen] = useState(false);
  const changed = hasDateChanges(a);

  const rowHighlight = isStaged
    ? isCascaded
      ? "border-l-2 border-l-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
      : "border-l-2 border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
    : "";

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className={`cursor-pointer border-b border-gray-100 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50 ${rowHighlight}`}
      >
        <td className="px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className={`text-xs transition ${open ? "rotate-90" : ""}`}>▶</span>
            {a.description}
            {isStaged && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${isCascaded ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}>
                {isCascaded ? "Cascaded" : "Staged"}
              </span>
            )}
          </div>
        </td>
        {/* Mobile start date */}
        <td className="px-3 py-2.5 text-center text-xs md:hidden">
          <span className={stagedFields?.has("start_date") ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
            {formatDateCompact(a.current_start_date)}
          </span>
        </td>
        <td className="hidden px-3 py-2.5 text-sm sm:table-cell">{a.trade_partner_name ?? "—"}</td>
        {/* Status: dot on mobile, badge on desktop */}
        <td className="px-3 py-2.5 text-center">
          <span className="md:hidden">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[a.status] ?? "bg-gray-400"}`} title={a.status} />
          </span>
          <span className="hidden md:inline">
            <StatusBadge status={a.status} />
          </span>
        </td>
        <td className="hidden px-3 py-2.5 text-center text-sm md:table-cell">
          <span className={stagedFields?.has("start_date") ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
            {formatDateCompact(a.current_start_date)}
          </span>
          <Drift original={a.original_start_date} current={a.current_start_date} />
        </td>
        <td className="hidden px-3 py-2.5 text-center text-sm md:table-cell">
          <span className={stagedFields?.has("end_date") ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
            {formatDateCompact(a.current_end_date)}
          </span>
          <Drift original={a.original_end_date} current={a.current_end_date} />
        </td>
        <td className="hidden px-3 py-2.5 text-sm text-center lg:table-cell">
          <span className={stagedFields?.has("duration") ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
            {a.current_duration ?? "—"}
          </span>
          <DurationDrift original={a.original_duration} current={a.current_duration} />
        </td>
      </tr>
      {open && (
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <td colSpan={7} className="bg-gray-50/50 px-6 py-3 dark:bg-gray-900/30">
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
            {onEditClick && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditClick(a); }}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  Edit Activity
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
