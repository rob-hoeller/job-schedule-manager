"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Activity, Dependency, CalendarDay } from "@/types";
import { ActivityDetailPopup } from "./ActivityDetailPopup";
import { parseLocalDate } from "@/lib/utils";

/* ── constants ── */
const ROW_H = 32;
const BAR_H = 20;
const BAR_Y_OFFSET = (ROW_H - BAR_H) / 2;
const HEADER_H = 58;
const WEEKDAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const LABEL_W = 280;

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

import type { StagedChange } from "@/hooks/useStaging";

interface Props {
  activities: Activity[];
  dependencies: Dependency[];
  calendarDays: Map<string, CalendarDay>;
  onActivityClick?: (activity: Activity) => void;
  stagedChanges?: Map<number, Map<string, StagedChange>>;
}

/** Generate abbreviation from activity name: "Install Silt Fence" → "ISF" */
function abbreviate(name: string): string {
  const words = name.split(/[\s/&-]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase();
}

/* ── main component ── */
export function GanttView({ activities, dependencies, calendarDays, onActivityClick, stagedChanges }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const mobileChartRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const highlightedRow: number | null = null;

  const colW = 44; // Day-level zoom

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

  /* Sorted activities */
  const sorted = useMemo(
    () => [...activities]
      .sort((a, b) => (a.current_start_date ?? "").localeCompare(b.current_start_date ?? "")),
    [activities],
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
    const sd = parseLocalDate(min);
    const ed = parseLocalDate(max);
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
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = parseLocalDate(todayStr);
    const off = daysBetween(startDate, today);
    return off >= 0 && off < totalDays ? off * colW + colW / 2 : null;
  }, [startDate, totalDays, colW]);

  /* Sync scroll between label panel and chart */
  const onChartScroll = useCallback(() => {
    if (chartRef.current && labelRef.current) {
      labelRef.current.scrollTop = chartRef.current.scrollTop;
    }
  }, []);

  const scrollToToday = useCallback(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const firstIdx = sorted.findIndex((a) => (a.current_end_date ?? a.current_start_date ?? "") >= todayStr);

    for (const ref of [chartRef, mobileChartRef]) {
      if (!ref.current) continue;
      if (todayOffset !== null) {
        ref.current.scrollLeft = Math.max(0, todayOffset - ref.current.clientWidth / 3);
      }
      if (firstIdx > 0) {
        ref.current.scrollTop = firstIdx * ROW_H;
      }
    }
    if (firstIdx > 0 && labelRef.current) {
      labelRef.current.scrollTop = firstIdx * ROW_H;
    }
  }, [todayOffset, sorted]);

  /* Scroll to today on initial load only */
  const hasScrolled = useRef(false);
  useEffect(() => {
    if (hasScrolled.current || sorted.length === 0) return;
    hasScrolled.current = true;
    requestAnimationFrame(scrollToToday);
  }, [scrollToToday, sorted.length]);

  /* Exit fullscreen on Escape */
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  /* Refs for fullscreen panels */
  const fsChartRef = useRef<HTMLDivElement>(null);
  const fsLabelRef = useRef<HTMLDivElement>(null);
  const onFsChartScroll = useCallback(() => {
    if (fsChartRef.current && fsLabelRef.current) {
      fsLabelRef.current.scrollTop = fsChartRef.current.scrollTop;
    }
  }, []);

  function handleBarClick(a: Activity) {
    if (onActivityClick) onActivityClick(a);
    else setSelected(a);
  }

  if (sorted.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">No activities to display.</p>;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Dependency legend + Today button */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">Dependency:</span>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-500/70 dark:bg-blue-400/70" />
          <span>Finish → Start</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-orange-600/70 dark:bg-orange-400/70" />
          <span>Start → Start</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={scrollToToday}
            className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >Today</button>
          <button
            onClick={() => setIsFullscreen(true)}
            className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            title="Fullscreen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3.28 2.22a.75.75 0 00-1.06 1.06L5.44 6.5H2.75a.75.75 0 000 1.5h4.5A.75.75 0 008 7.25v-4.5a.75.75 0 00-1.5 0v2.69L3.28 2.22zM16.72 2.22a.75.75 0 010 1.06L13.56 6.5h2.69a.75.75 0 010 1.5h-4.5A.75.75 0 0111 7.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 0zM3.28 17.78a.75.75 0 001.06 0l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69L3.28 16.72a.75.75 0 000 1.06zM16.72 17.78a.75.75 0 01-1.06 0l-3.22-3.22v2.69a.75.75 0 01-1.5 0v-4.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-2.69l3.22 3.22a.75.75 0 010 1.06z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile: chart only ── */}
      <div className={`min-h-0 flex-1 flex flex-col sm:hidden ${isFullscreen ? "hidden" : ""}`}>
        <div
          ref={mobileChartRef}
          className="gantt-chart-area relative min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800"
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
            isMobile
            scrollRef={mobileChartRef}
            onBarClick={handleBarClick}
                stagedChanges={stagedChanges}
          />
        </div>
      </div>

      {/* ── Desktop: split panel ── */}
      <div className={`min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 ${isFullscreen ? "hidden" : "hidden sm:flex"}`}>
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
            onBarClick={handleBarClick}
                stagedChanges={stagedChanges}
            scrollRef={chartRef}
          />
        </div>
      </div>

      {/* ── Fullscreen overlay ── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950">
          {/* Fullscreen header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-800">
            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Dependency:</span>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500/70 dark:bg-blue-400/70" />
                <span>Finish → Start</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-orange-600/70 dark:bg-orange-400/70" />
                <span>Start → Start</span>
              </div>
              <button
                onClick={() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const firstIdx = sorted.findIndex((a) => (a.current_end_date ?? a.current_start_date ?? "") >= todayStr);
                  if (fsChartRef.current && todayOffset !== null) {
                    fsChartRef.current.scrollLeft = Math.max(0, todayOffset - fsChartRef.current.clientWidth / 3);
                    if (firstIdx > 0) fsChartRef.current.scrollTop = firstIdx * ROW_H;
                  }
                  if (firstIdx > 0 && fsLabelRef.current) {
                    fsLabelRef.current.scrollTop = firstIdx * ROW_H;
                  }
                }}
                className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >Today</button>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Exit fullscreen (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Fullscreen chart */}
          <div className="flex min-h-0 flex-1">
            {/* Labels */}
            <div className="hidden shrink-0 border-r border-gray-200 sm:block dark:border-gray-800" style={{ width: LABEL_W }}>
              <div className="flex items-end border-b border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-900" style={{ height: HEADER_H }}>
                Activity
              </div>
              <div ref={fsLabelRef} className="overflow-hidden" style={{ height: `calc(100% - ${HEADER_H}px)` }}>
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

            {/* Chart */}
            <div
              ref={fsChartRef}
              onScroll={onFsChartScroll}
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
                onBarClick={handleBarClick}
                stagedChanges={stagedChanges}
                scrollRef={fsChartRef}
              />
            </div>
          </div>
        </div>
      )}

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

/* ── Background grid (memoized to avoid re-render on scroll) ── */
const GanttBackground = memo(function GanttBackground({
  dates, colW, chartH, chartW, rowCount, calendarDays,
}: {
  dates: Date[]; colW: number; chartH: number; chartW: number; rowCount: number; calendarDays: Map<string, CalendarDay>;
}) {
  const monthLines: string[] = [];
  const dayLines: string[] = [];
  const offDayRects: React.ReactNode[] = [];
  dates.forEach((d, i) => {
    const x = i * colW;
    if (d.getDate() === 1) monthLines.push(`M${x},0V${chartH}`);
    else dayLines.push(`M${x},0V${chartH}`);
    const key = toKey(d);
    const cd = calendarDays.get(key);
    const isOffDay = cd ? cd.is_workday === 0 : (d.getDay() === 0 || d.getDay() === 6);
    if (isOffDay) offDayRects.push(<rect key={`off-${i}`} x={x} y={0} width={colW} height={chartH} />);
  });
  const rowStripes: React.ReactNode[] = [];
  for (let i = 1; i < rowCount; i += 2) {
    rowStripes.push(<rect key={`row-${i}`} x={0} y={i * ROW_H} width={chartW} height={ROW_H} />);
  }
  return (
    <>
      <path d={dayLines.join("")} className="stroke-gray-400/80 dark:stroke-gray-800/80" strokeWidth={0.5} fill="none" />
      <path d={monthLines.join("")} className="stroke-gray-400 dark:stroke-gray-700" strokeWidth={1} fill="none" />
      <g className="fill-gray-100/60 dark:fill-gray-800/30">{offDayRects}</g>
      <g className="fill-gray-50/40 dark:fill-gray-900/20">{rowStripes}</g>
    </>
  );
});

/* ── Viewport hook for scroll-based culling ── */
function useViewport(scrollRef: React.RefObject<HTMLElement | null>) {
  const [vp, setVp] = useState({ scrollX: 0, scrollY: 0, width: 2000, height: 1200 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setVp({ scrollX: el.scrollLeft, scrollY: el.scrollTop, width: el.clientWidth, height: el.clientHeight });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [scrollRef]);
  return vp;
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
  isMobile = false,
  onBarClick,
  stagedChanges,
  scrollRef,
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
  isMobile?: boolean;
  onBarClick: (a: Activity) => void;
  stagedChanges?: Map<number, Map<string, StagedChange>>;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
  const BUFFER = 200; // px buffer around viewport
  const vp = useViewport(scrollRef);
  const vpLeft = vp.scrollX - BUFFER;
  const vpRight = vp.scrollX + vp.width + BUFFER;
  const vpTop = vp.scrollY - HEADER_H - BUFFER;
  const vpBottom = vp.scrollY + vp.height + BUFFER;

  // Visible column range
  const colStart = Math.max(0, Math.floor(vpLeft / colW));
  const colEnd = Math.min(dates.length, Math.ceil(vpRight / colW));
  // Visible row range
  const rowStart = Math.max(0, Math.floor(vpTop / ROW_H));
  const rowEnd = Math.min(sorted.length, Math.ceil(vpBottom / ROW_H));

  // Visible header dates
  const visibleHeaderDates = useMemo(() => {
    const result: { d: Date; i: number; key: string }[] = [];
    for (let i = colStart; i < colEnd; i++) {
      result.push({ d: dates[i], i, key: toKey(dates[i]) });
    }
    return result;
  }, [dates, colStart, colEnd]);

  return (
    <div style={{ width: chartW }}>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10">
        <svg width={chartW} height={HEADER_H} className="select-none">
          <rect x={0} y={0} width={chartW} height={HEADER_H} className="fill-gray-50 dark:fill-gray-900" />
          {visibleHeaderDates.map(({ d, i, key }) => {
            const x = i * colW;
            const cd = calendarDays.get(key);
            const isOffDay = cd ? cd.is_workday === 0 : (d.getDay() === 0 || d.getDay() === 6);
            const isFirst = d.getDate() === 1;

            return (
              <g key={key}>
                {isFirst && (
                  <text x={x + 2} y={14} className="fill-gray-700 text-[10px] font-semibold dark:fill-gray-300">
                    {d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </text>
                )}
                {(colW >= 44 || isFirst) && (
                  <>
                    <text x={x + colW / 2} y={HEADER_H - 18} textAnchor="middle" className={`text-[8px] font-medium ${isOffDay ? "fill-gray-400 dark:fill-gray-600" : "fill-gray-500 dark:fill-gray-400"}`}>
                      {WEEKDAY_ABBR[d.getDay()]}
                    </text>
                    <text x={x + colW / 2} y={HEADER_H - 6} textAnchor="middle" className={`text-[9px] ${isOffDay ? "fill-gray-400 dark:fill-gray-600" : "fill-gray-500 dark:fill-gray-400"}`}>
                      {colW >= 60 ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : d.getDate()}
                    </text>
                  </>
                )}
                {isFirst && (
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
      {/* ── Background: columns, off-days, row stripes (batched paths) ── */}
      <GanttBackground dates={dates} colW={colW} chartH={chartH} chartW={chartW} rowCount={sorted.length} calendarDays={calendarDays} />

      {/* ── Dependency arrows (only if either end is visible) ── */}
      <g className="pointer-events-none">
        {dependencies.map((d) => {
          const predIdx = rowIndex.get(d.predecessor_jsa_rid);
          const succIdx = rowIndex.get(d.successor_jsa_rid);
          if (predIdx === undefined || succIdx === undefined) return null;

          // Row culling: skip if both rows are outside viewport
          const minRow = Math.min(predIdx, succIdx);
          const maxRow = Math.max(predIdx, succIdx);
          if (maxRow < rowStart || minRow > rowEnd) return null;

          const pred = activityMap.get(d.predecessor_jsa_rid);
          const succ = activityMap.get(d.successor_jsa_rid);
          if (!pred || !succ) return null;

          const predStart = pred.current_start_date ? daysBetween(startDate, parseLocalDate(pred.current_start_date)) : 0;
          const predEnd = pred.current_end_date ? daysBetween(startDate, parseLocalDate(pred.current_end_date)) + 1 : predStart + 1;
          const succStart = succ.current_start_date ? daysBetween(startDate, parseLocalDate(succ.current_start_date)) : 0;

          let fromX: number;
          if (d.dependency_type === "FS") {
            fromX = predEnd * colW;
          } else {
            fromX = predStart * colW;
          }
          const toX = succStart * colW;

          // Column culling: skip if entirely outside viewport
          const minX = Math.min(fromX, toX);
          const maxX = Math.max(fromX, toX);
          if (maxX < vpLeft || minX > vpRight) return null;

          const fromY = predIdx * ROW_H + ROW_H / 2;
          const toY = succIdx * ROW_H + ROW_H / 2;

          const midX = d.dependency_type === "FS"
            ? Math.max(fromX + 8, toX - 8)
            : Math.min(fromX - 8, toX - 8);

          const path = `M${fromX},${fromY} L${midX},${fromY} L${midX},${toY} L${toX},${toY}`;

          const isFS = d.dependency_type === "FS";
          const strokeClass = isFS
            ? "stroke-blue-500/70 dark:stroke-blue-400/70"
            : "stroke-orange-600/70 dark:stroke-orange-400/70";
          const fillClass = isFS
            ? "fill-blue-500/70 dark:fill-blue-400/70"
            : "fill-orange-600/70 dark:fill-orange-400/70";

          return (
            <g key={d.job_schedule_activity_dependency_id}>
              <path
                d={path}
                fill="none"
                className={strokeClass}
                strokeWidth={1}
              />
              <polygon
                points={`${toX},${toY} ${toX - 4},${toY - 3} ${toX - 4},${toY + 3}`}
                className={fillClass}
              />
            </g>
          );
        })}
      </g>

      {/* ── Activity bars (viewport-culled) ── */}
      {sorted.map((a, i) => {
        if (!a.current_start_date) return null;
        // Row culling
        if (i < rowStart || i > rowEnd) return null;

        const sd = parseLocalDate(a.current_start_date);
        const ed = a.current_end_date ? parseLocalDate(a.current_end_date) : sd;
        const startOff = daysBetween(startDate, sd);
        const span = daysBetween(sd, ed) + 1;
        const x = startOff * colW;
        const w = Math.max(span * colW - 2, 4);

        // Column culling
        if (x + w < vpLeft || x > vpRight) return null;

        const y = i * ROW_H + BAR_Y_OFFSET;

        const isStaged = stagedChanges?.has(a.jsa_rid) ?? false;
        const isCascaded = isStaged && ![...(stagedChanges!.get(a.jsa_rid)!.values())].some((c) => c.is_direct_edit);

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
              className="hover:brightness-90"
              strokeDasharray={isStaged ? "4 2" : undefined}
              stroke={isStaged ? (isCascaded ? "#f97316" : "#f59e0b") : undefined}
              strokeWidth={isStaged ? 2 : undefined}
            />
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
