"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Activity, Dependency, CalendarDay } from "@/types";
import { ActivityDetailPopup } from "./ActivityDetailPopup";
import { statusClass } from "@/lib/utils";

/* ── constants ── */
const ROW_H = 32;
const BAR_H = 20;
const BAR_Y_OFFSET = (ROW_H - BAR_H) / 2;
const HEADER_H = 48;
const LABEL_W = 280;
const ZOOM_LEVELS = [24, 32, 44, 60, 80];

/* ── colour fills for SVG bars (darker shades for white text legibility) ── */
const FILL: Record<string, string> = {
  Released: "#2563eb",
  Approved: "#16a34a",
  Completed: "#6b7280",
};
function fill(status: string) {
  return FILL[status] ?? "#9ca3af";
}
/* ── date helpers ── */
function toKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

interface Props {
  activities: Activity[];
  dependencies: Dependency[];
  calendarDays: Map<string, CalendarDay>;
}

/** Generate abbreviation from activity name: "Install Silt Fence" → "ISF" */
function abbreviate(name: string): string {
  const words = name.split(/[\s/&-]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase();
}

/* ── main component ── */
export function GanttView({ activities, dependencies, calendarDays }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [zoomIdx, setZoomIdx] = useState(2);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set(["Approved"]));
  const highlightedRow: number | null = null;

  const colW = ZOOM_LEVELS[zoomIdx];

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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of activities) counts[a.status] = (counts[a.status] ?? 0) + 1;
    return counts;
  }, [activities]);

  function toggleStatus(status: string) {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  /* Sorted + filtered activities */
  const sorted = useMemo(
    () => [...activities]
      .filter((a) => !hiddenStatuses.has(a.status))
      .sort((a, b) => (a.current_start_date ?? "").localeCompare(b.current_start_date ?? "")),
    [activities, hiddenStatuses],
  );

  /* Row index by jsa_rid */
  const rowIndex = useMemo(
    () => new Map(sorted.map((a, i) => [a.jsa_rid, i])),
    [sorted],
  );

  /* Date range */
  const { startDate, totalDays, dates } = useMemo(() => {
    let min = "9999-99-99";
    let max = "0000-00-00";
    for (const a of activities) {
      if (a.current_start_date && a.current_start_date < min) min = a.current_start_date;
      if (a.current_end_date && a.current_end_date > max) max = a.current_end_date;
      if (a.current_start_date && a.current_start_date > max) max = a.current_start_date;
    }
    if (min > max) return { startDate: new Date(), totalDays: 0, dates: [] };
    const sd = new Date(min);
    const ed = new Date(max);
    const total = daysBetween(sd, ed) + 1;
    const ds: Date[] = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(sd);
      d.setDate(d.getDate() + i);
      ds.push(d);
    }
    return { startDate: sd, totalDays: total, dates: ds };
  }, [activities]);

  const chartW = totalDays * colW;
  const chartH = sorted.length * ROW_H;

  /* Today line position */
  const todayOffset = useMemo(() => {
    const today = new Date();
    const off = daysBetween(startDate, today);
    return off >= 0 && off < totalDays ? off * colW + colW / 2 : null;
  }, [startDate, totalDays, colW]);

  /* Sync scroll between label panel and chart */
  const onChartScroll = useCallback(() => {
    if (chartRef.current && labelRef.current) {
      labelRef.current.scrollTop = chartRef.current.scrollTop;
    }
  }, []);

  /* Scroll to today on mount — horizontal to today line, vertical to first activity on/after today */
  useEffect(() => {
    if (!chartRef.current) return;
    if (todayOffset !== null) {
      chartRef.current.scrollLeft = Math.max(0, todayOffset - chartRef.current.clientWidth / 3);
    }
    const todayStr = toKey(new Date());
    const firstIdx = sorted.findIndex((a) => (a.current_end_date ?? a.current_start_date ?? "") >= todayStr);
    if (firstIdx > 0) {
      chartRef.current.scrollTop = firstIdx * ROW_H;
      if (labelRef.current) labelRef.current.scrollTop = firstIdx * ROW_H;
    }
  }, [todayOffset, sorted]);

  function handleBarClick(a: Activity) {
    setSelected(a);
  }

  if (sorted.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">No activities to display.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Zoom:</span>
        <button
          onClick={() => setZoomIdx(Math.max(0, zoomIdx - 1))}
          disabled={zoomIdx === 0}
          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-30 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >−</button>
        <span className="w-16 text-center text-xs text-gray-500">
          {colW <= 32 ? "Week" : colW <= 44 ? "Day" : "Detail"}
        </span>
        <button
          onClick={() => setZoomIdx(Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1))}
          disabled={zoomIdx === ZOOM_LEVELS.length - 1}
          className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-30 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >+</button>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{sorted.length} activities</span>
        <span className="text-gray-400">—</span>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => toggleStatus(status)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${statusClass(status)} ${hiddenStatuses.has(status) ? "opacity-30 line-through" : "hover:opacity-80"}`}
          >
            {status} <span className="font-normal">{count}</span>
          </button>
        ))}
      </div>

      {/* ── Mobile: chart only ── */}
      <div className="sm:hidden">
        <div
          ref={chartRef}
          onScroll={onChartScroll}
          className="gantt-chart-area relative overflow-auto rounded-lg border border-gray-200 dark:border-gray-800"
          style={{ maxHeight: "calc(100vh - 340px)" }}
        >
          <GanttChart
            sorted={sorted}
            rowIndex={rowIndex}
            dependencies={dependencies}
            activityMap={activityMap}
            calendarDays={calendarDays}
            dates={dates}
            startDate={startDate}
            colW={colW}
            chartW={chartW}
            chartH={chartH}
            todayOffset={todayOffset}
            highlightedRow={highlightedRow}
            isMobile
            onBarClick={handleBarClick}
          />
        </div>
      </div>

      {/* ── Desktop: split panel ── */}
      <div className="hidden overflow-hidden rounded-lg border border-gray-200 sm:flex dark:border-gray-800" style={{ maxHeight: "calc(100vh - 340px)" }}>
        {/* Left: activity labels */}
        <div
          className="shrink-0 border-r border-gray-200 dark:border-gray-800"
          style={{ width: LABEL_W }}
        >
          {/* Fixed header */}
          <div className="flex items-end border-b border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-900" style={{ height: HEADER_H }}>
            Activity
          </div>
          {/* Scrollable label rows — synced from chart */}
          <div ref={labelRef} className="overflow-hidden" style={{ height: `calc(100% - ${HEADER_H}px)` }}>
            {sorted.map((a, i) => (
              <div
                key={a.job_schedule_activity_id}
                className={`flex items-center gap-1.5 border-b border-gray-50 px-2 text-xs dark:border-gray-900 ${highlightedRow === i ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-900/30"}`}
                style={{ height: ROW_H }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: fill(a.status) }} />
                <span className="truncate" title={a.description}>{a.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: chart */}
        <div
          ref={chartRef}
          onScroll={onChartScroll}
          className="gantt-chart-area relative flex-1 overflow-auto"
        >
          <GanttChart
            sorted={sorted}
            rowIndex={rowIndex}
            dependencies={dependencies}
            activityMap={activityMap}
            calendarDays={calendarDays}
            dates={dates}
            startDate={startDate}
            colW={colW}
            chartW={chartW}
            chartH={chartH}
            todayOffset={todayOffset}
            highlightedRow={highlightedRow}
            onBarClick={handleBarClick}
          />
        </div>
      </div>

      {/* Detail popup */}
      {selected && (
        <ActivityDetailPopup
          activity={selected}
          predecessors={predMap.get(selected.jsa_rid) ?? []}
          successors={succMap.get(selected.jsa_rid) ?? []}
          activityMap={activityMap}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ── SVG chart (shared between mobile/desktop) ── */
function GanttChart({
  sorted,
  rowIndex,
  dependencies,
  activityMap,
  calendarDays,
  dates,
  startDate,
  colW,
  chartW,
  chartH,
  todayOffset,
  highlightedRow,
  isMobile = false,
  onBarClick,
}: {
  sorted: Activity[];
  rowIndex: Map<number, number>;
  dependencies: Dependency[];
  activityMap: Map<number, Activity>;
  calendarDays: Map<string, CalendarDay>;
  dates: Date[];
  startDate: Date;
  colW: number;
  chartW: number;
  chartH: number;
  todayOffset: number | null;
  highlightedRow: number | null;
  isMobile?: boolean;
  onBarClick: (a: Activity) => void;
}) {
  return (
    <div style={{ width: chartW }}>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10">
        <svg width={chartW} height={HEADER_H} className="select-none">
          <rect x={0} y={0} width={chartW} height={HEADER_H} className="fill-gray-50 dark:fill-gray-900" />
          {dates.map((d, i) => {
            const x = i * colW;
            const key = toKey(d);
            const cd = calendarDays.get(key);
            const isOffDay = cd ? cd.is_workday === 0 : (d.getDay() === 0 || d.getDay() === 6);
            const isMonday = d.getDay() === 1;
            const isFirst = d.getDate() === 1;

            return (
              <g key={key}>
                {isFirst && (
                  <text x={x + 2} y={14} className="fill-gray-700 text-[10px] font-semibold dark:fill-gray-300">
                    {d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </text>
                )}
                {(colW >= 44 || isMonday || isFirst) && (
                  <text x={x + colW / 2} y={HEADER_H - 6} textAnchor="middle" className={`text-[9px] ${isOffDay ? "fill-gray-400 dark:fill-gray-600" : "fill-gray-500 dark:fill-gray-400"}`}>
                    {colW >= 60 ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : d.getDate()}
                  </text>
                )}
                {(isMonday || isFirst) && (
                  <line x1={x} y1={0} x2={x} y2={HEADER_H} className="stroke-gray-200 dark:stroke-gray-800" strokeWidth={0.5} />
                )}
              </g>
            );
          })}
          <line x1={0} y1={HEADER_H - 1} x2={chartW} y2={HEADER_H - 1} className="stroke-gray-200 dark:stroke-gray-800" strokeWidth={1} />
        </svg>
      </div>

      {/* ── Chart body ── */}
      <svg width={chartW} height={chartH} className="select-none">
      {/* ── Column separators ── */}
      {dates.map((d, i) => {
        const isMonday = d.getDay() === 1;
        const isFirst = d.getDate() === 1;
        if (!isMonday && !isFirst) return null;
        return (
          <line key={`col-${toKey(d)}`} x1={i * colW} y1={0} x2={i * colW} y2={chartH} className="stroke-gray-200 dark:stroke-gray-800" strokeWidth={0.5} />
        );
      })}

      {/* ── Non-workday bands ── */}
      {dates.map((d, i) => {
        const key = toKey(d);
        const cd = calendarDays.get(key);
        const isOffDay = cd ? cd.is_workday === 0 : (d.getDay() === 0 || d.getDay() === 6);
        if (!isOffDay) return null;
        return (
          <rect
            key={`off-${key}`}
            x={i * colW}
            y={0}
            width={colW}
            height={chartH}
            className="fill-gray-100/60 dark:fill-gray-800/30"
          />
        );
      })}

      {/* ── Row stripes ── */}
      {sorted.map((_, i) => (
        <rect
          key={`row-${i}`}
          x={0}
          y={i * ROW_H}
          width={chartW}
          height={ROW_H}
          className={
            highlightedRow === i
              ? "fill-blue-50 dark:fill-blue-950/40"
              : i % 2 === 0
                ? "fill-transparent"
                : "fill-gray-50/40 dark:fill-gray-900/20"
          }
        />
      ))}

      {/* ── Dependency arrows ── */}
      <g className="pointer-events-none">
        {dependencies.map((d) => {
          const predIdx = rowIndex.get(d.predecessor_jsa_rid);
          const succIdx = rowIndex.get(d.successor_jsa_rid);
          if (predIdx === undefined || succIdx === undefined) return null;
          const pred = activityMap.get(d.predecessor_jsa_rid);
          const succ = activityMap.get(d.successor_jsa_rid);
          if (!pred || !succ) return null;

          const predStart = pred.current_start_date ? daysBetween(startDate, new Date(pred.current_start_date)) : 0;
          const predEnd = pred.current_end_date ? daysBetween(startDate, new Date(pred.current_end_date)) + 1 : predStart + 1;
          const succStart = succ.current_start_date ? daysBetween(startDate, new Date(succ.current_start_date)) : 0;

          let fromX: number;
          if (d.dependency_type === "FS") {
            fromX = predEnd * colW; // end of predecessor
          } else {
            fromX = predStart * colW; // start of predecessor (SS)
          }
          const toX = succStart * colW;
          const fromY = predIdx * ROW_H + ROW_H / 2;
          const toY = succIdx * ROW_H + ROW_H / 2;

          // Path: horizontal out, then vertical, then horizontal to target
          const midX = d.dependency_type === "FS"
            ? Math.max(fromX + 8, toX - 8)
            : Math.min(fromX - 8, toX - 8);

          const path = `M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX},${toY}`;

          return (
            <g key={d.job_schedule_activity_dependency_id}>
              <path
                d={path}
                fill="none"
                className="stroke-gray-400/50 dark:stroke-gray-600/50"
                strokeWidth={1}
              />
              {/* Arrow head */}
              <polygon
                points={`${toX},${toY} ${toX - 4},${toY - 3} ${toX - 4},${toY + 3}`}
                className="fill-gray-400/50 dark:fill-gray-600/50"
              />
            </g>
          );
        })}
      </g>

      {/* ── Activity bars ── */}
      {sorted.map((a, i) => {
        if (!a.current_start_date) return null;
        const sd = new Date(a.current_start_date);
        const ed = a.current_end_date ? new Date(a.current_end_date) : sd;
        const startOff = daysBetween(startDate, sd);
        const span = daysBetween(sd, ed) + 1;
        const x = startOff * colW;
        const w = Math.max(span * colW - 2, 4);
        const y = i * ROW_H + BAR_Y_OFFSET;

        return (
          <g
            key={a.job_schedule_activity_id}
            className="cursor-pointer"
            onClick={() => onBarClick(a)}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={BAR_H}
              rx={3}
              fill={fill(a.status)}
              className="transition-colors hover:brightness-90"
            />
            {/* Label on bar */}
            {(isMobile ? w > 16 : w > 50) && (
              <text
                x={x + 4}
                y={y + BAR_H / 2 + 1}
                dominantBaseline="middle"
                className="pointer-events-none fill-white text-[9px] font-medium"
              >
                {isMobile
                  ? abbreviate(a.description)
                  : a.description.length > w / 6 ? a.description.slice(0, Math.floor(w / 6)) + "…" : a.description}
              </text>
            )}
          </g>
        );
      })}

      {/* ── Today line ── */}
      {todayOffset !== null && (
        <g>
          <line
            x1={todayOffset}
            y1={0}
            x2={todayOffset}
            y2={chartH}
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
          <text x={todayOffset + 3} y={12} className="fill-red-500 text-[9px] font-semibold">
            Today
          </text>
        </g>
      )}
    </svg>
    </div>
  );
}
