"use client";

import { useMemo, useState, useEffect } from "react";
import type { Activity, Dependency } from "@/types";
import { ActivityRow } from "./ActivityRow";

import type { StagedChange } from "@/hooks/useStaging";

interface Props {
  activities: Activity[];
  dependencies: Dependency[];
  onActivityClick?: (activity: Activity, mode?: "move_start" | "change_duration" | "status") => void;
  stagedChanges?: Map<number, Map<string, StagedChange>>;
}

type FilterMode = "all" | "not_approved" | "late" | "staged";

const COL_HEADERS: { label: string; className: string }[] = [
  { label: "Activity", className: "" },
  { label: "Start", className: "text-center md:hidden" },
  { label: "Trade Partner", className: "hidden sm:table-cell" },
  { label: "Status", className: "text-center" },
  { label: "Start", className: "hidden md:table-cell text-center" },
  { label: "End", className: "hidden md:table-cell text-center" },
  { label: "Days", className: "hidden lg:table-cell text-center" },
];

export function ListView({ activities, dependencies, onActivityClick, stagedChanges }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterMode>("not_approved");
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const activityMap = useMemo(
    () => new Map(activities.map((a) => [a.jsa_rid, a])),
    [activities],
  );

  const predMap = useMemo(() => {
    const m = new Map<number, Dependency[]>();
    for (const d of dependencies) {
      const arr = m.get(d.successor_jsa_rid) ?? [];
      arr.push(d);
      m.set(d.successor_jsa_rid, arr);
    }
    return m;
  }, [dependencies]);

  const succMap = useMemo(() => {
    const m = new Map<number, Dependency[]>();
    for (const d of dependencies) {
      const arr = m.get(d.predecessor_jsa_rid) ?? [];
      arr.push(d);
      m.set(d.predecessor_jsa_rid, arr);
    }
    return m;
  }, [dependencies]);

  const lateCount = useMemo(() => {
    if (!today) return 0;
    return activities.filter(
      (a) => a.status !== "Approved" && a.current_end_date !== null && a.current_end_date < today,
    ).length;
  }, [activities, today]);

  const stagedCount = stagedChanges?.size ?? 0;
  const notApprovedCount = useMemo(() => activities.filter((a) => a.status !== "Approved").length, [activities]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let result = activities;

    if (filter === "not_approved") {
      result = result.filter((a) => a.status !== "Approved");
    } else if (filter === "late" && today) {
      result = result.filter(
        (a) => a.status !== "Approved" && a.current_end_date !== null && a.current_end_date < today,
      );
    } else if (filter === "staged" && stagedChanges && stagedChanges.size > 0) {
      result = result.filter((a) => stagedChanges.has(a.jsa_rid));
    }

    if (q)
      result = result.filter(
        (a) =>
          a.description.toLowerCase().includes(q) ||
          (a.trade_partner_name?.toLowerCase().includes(q) ?? false),
      );

    return [...result].sort((a, b) =>
      (a.current_start_date ?? "").localeCompare(b.current_start_date ?? ""),
    );
  }, [activities, query, filter, stagedChanges, today]);

  const isStaging = stagedCount > 0;

  // Reset to default filter when staging ends (discard/publish)
  useEffect(() => {
    if (!isStaging && filter === "staged") setFilter("not_approved");
  }, [isStaging, filter]);

  const filters: { mode: FilterMode; label: string; count?: number; show: boolean }[] = [
    { mode: "all", label: "All", count: activities.length, show: true },
    { mode: "not_approved", label: "Not Approved", count: notApprovedCount, show: true },
    { mode: "late", label: "Late", count: lateCount, show: lateCount > 0 },
    { mode: "staged", label: "Staged", count: stagedCount, show: isStaging },
  ];

  function filterStyle(mode: FilterMode) {
    const active = filter === mode;
    if (mode === "late") {
      return active
        ? "bg-red-600 text-white"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700";
    }
    if (mode === "staged") {
      return active
        ? "bg-amber-600 text-white"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700";
    }
    return active
      ? "bg-blue-600 text-white"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700";
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Filter toggles */}
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.filter((f) => f.show).map((f) => (
          <button
            key={f.mode}
            onClick={() => setFilter(f.mode)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${filterStyle(f.mode)}`}
          >
            {f.label}{f.count !== undefined ? ` (${f.count})` : ""}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Filter by activity or trade partner…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900"
      />

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              {COL_HEADERS.map((h, i) => (
                <th key={`${h.label}-${i}`} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h.className}`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <ActivityRow
                key={a.job_schedule_activity_id}
                activity={a}
                predecessors={predMap.get(a.jsa_rid) ?? []}
                successors={succMap.get(a.jsa_rid) ?? []}
                activityMap={activityMap}
                onEditClick={onActivityClick}
                isStaged={stagedChanges?.has(a.jsa_rid) ?? false}
                isCascaded={
                  stagedChanges?.has(a.jsa_rid)
                    ? ![...(stagedChanges.get(a.jsa_rid)?.values() ?? [])].some((c) => c.is_direct_edit)
                    : false
                }
                stagedFields={stagedChanges?.get(a.jsa_rid)}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No activities match your filter.</p>
        )}
      </div>
    </div>
  );
}
