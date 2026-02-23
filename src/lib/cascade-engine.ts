/**
 * Cascade Engine — Schedule Dependency Propagation
 *
 * Given a set of direct edits (Move Start or Change Duration), calculates
 * all downstream cascading effects through the dependency chain.
 *
 * Rules:
 * - FS (Finish-Start): successor start = predecessor end + lag_days (workdays)
 * - SS (Start-Start): successor start = predecessor start + lag_days (workdays)
 * - Multiple predecessors: latest calculated date wins (most constraining)
 * - Duration is NEVER changed by cascade — only start/end dates shift
 * - End date = start date + duration (workdays)
 */

export interface CalendarDayEntry {
  day_date: string;
  is_workday: number;
}

export interface ActivitySnapshot {
  jsa_rid: number;
  schedule_rid: number;
  current_start_date: string | null;
  current_end_date: string | null;
  current_duration: number | null;
}

export interface DependencyRecord {
  predecessor_jsa_rid: number;
  successor_jsa_rid: number;
  dependency_type: "FS" | "SS";
  lag_days: number;
}

export interface StagedField {
  field_name: string;
  original_value: string | null;
  staged_value: string;
}

export interface CascadeChange {
  jsa_rid: number;
  field_name: string;
  old_value: string | null;
  new_value: string;
  is_direct_edit: boolean;
  source_jsa_rid: number | null;
}

/* ── Workday Calendar ── */

export class WorkdayCalendar {
  private workdays: Set<string>;
  private sortedDates: string[];

  constructor(calendarDays: CalendarDayEntry[]) {
    this.workdays = new Set(
      calendarDays.filter((d) => d.is_workday === 1).map((d) => d.day_date),
    );
    this.sortedDates = calendarDays.map((d) => d.day_date).sort();
  }

  isWorkday(date: string): boolean {
    return this.workdays.has(date);
  }

  /**
   * Add N workdays to a date. Positive = forward, negative = backward.
   * The start date itself is NOT counted as a workday in the offset.
   */
  addWorkdays(fromDate: string, days: number): string {
    if (days === 0) return fromDate;

    const direction = days > 0 ? 1 : -1;
    let remaining = Math.abs(days);
    let current = fromDate;

    while (remaining > 0) {
      current = this.adjacentDay(current, direction);
      if (this.workdays.has(current)) {
        remaining--;
      }
    }
    return current;
  }

  /**
   * Calculate end date from start date + duration (workdays).
   * Duration of 1 means start and end are the same workday.
   * Duration of N means end is (N-1) workdays after start.
   */
  calcEndDate(startDate: string, duration: number): string {
    if (duration <= 1) return startDate;
    return this.addWorkdays(startDate, duration - 1);
  }

  /**
   * Calculate workday duration between two dates (inclusive).
   */
  calcDuration(startDate: string, endDate: string): number {
    if (startDate === endDate) return 1;
    let count = 0;
    let current = startDate;
    while (current <= endDate) {
      if (this.workdays.has(current)) count++;
      current = this.adjacentDay(current, 1);
    }
    return Math.max(count, 1);
  }

  /**
   * If date is not a workday, advance to the next workday.
   */
  nextWorkday(date: string): string {
    let current = date;
    while (!this.workdays.has(current)) {
      current = this.adjacentDay(current, 1);
    }
    return current;
  }

  private adjacentDay(date: string, direction: 1 | -1): string {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + direction);
    return d.toISOString().slice(0, 10);
  }
}

/* ── Cascade Engine ── */

export function calculateCascade(
  directEdits: Map<number, { move_type: "move_start" | "change_duration"; value: string | number }>,
  activities: ActivitySnapshot[],
  dependencies: DependencyRecord[],
  calendar: WorkdayCalendar,
): CascadeChange[] {
  const changes: CascadeChange[] = [];

  // Build activity lookup
  const actMap = new Map<number, ActivitySnapshot>();
  for (const a of activities) actMap.set(a.jsa_rid, a);

  // Working state: current effective dates/durations (starts from live values)
  const state = new Map<number, { start: string; end: string; duration: number }>();
  for (const a of activities) {
    if (a.current_start_date && a.current_end_date && a.current_duration) {
      state.set(a.jsa_rid, {
        start: a.current_start_date,
        end: a.current_end_date,
        duration: a.current_duration,
      });
    }
  }

  // Apply direct edits first
  for (const [jsaRid, edit] of directEdits) {
    const current = state.get(jsaRid);
    if (!current) continue;
    const act = actMap.get(jsaRid)!;

    if (edit.move_type === "move_start") {
      const newStart = calendar.nextWorkday(edit.value as string);
      const newEnd = calendar.calcEndDate(newStart, current.duration);

      if (newStart !== current.start) {
        changes.push({
          jsa_rid: jsaRid,
          field_name: "start_date",
          old_value: act.current_start_date,
          new_value: newStart,
          is_direct_edit: true,
          source_jsa_rid: null,
        });
      }
      if (newEnd !== current.end) {
        changes.push({
          jsa_rid: jsaRid,
          field_name: "end_date",
          old_value: act.current_end_date,
          new_value: newEnd,
          is_direct_edit: true,
          source_jsa_rid: null,
        });
      }

      state.set(jsaRid, { start: newStart, end: newEnd, duration: current.duration });
    } else {
      // change_duration
      const newDuration = edit.value as number;
      const newEnd = calendar.calcEndDate(current.start, newDuration);

      if (newDuration !== current.duration) {
        changes.push({
          jsa_rid: jsaRid,
          field_name: "duration",
          old_value: act.current_duration?.toString() ?? null,
          new_value: newDuration.toString(),
          is_direct_edit: true,
          source_jsa_rid: null,
        });
      }
      if (newEnd !== current.end) {
        changes.push({
          jsa_rid: jsaRid,
          field_name: "end_date",
          old_value: act.current_end_date,
          new_value: newEnd,
          is_direct_edit: true,
          source_jsa_rid: null,
        });
      }

      state.set(jsaRid, { start: current.start, end: newEnd, duration: newDuration });
    }
  }

  // Build successor map for topological traversal
  const succMap = new Map<number, DependencyRecord[]>();
  const predMap = new Map<number, DependencyRecord[]>();
  for (const d of dependencies) {
    if (!succMap.has(d.predecessor_jsa_rid)) succMap.set(d.predecessor_jsa_rid, []);
    succMap.get(d.predecessor_jsa_rid)!.push(d);
    if (!predMap.has(d.successor_jsa_rid)) predMap.set(d.successor_jsa_rid, []);
    predMap.get(d.successor_jsa_rid)!.push(d);
  }

  // BFS from directly edited activities through dependency chain
  const affected = new Set<number>(directEdits.keys());
  const queue: number[] = [...directEdits.keys()];
  const visited = new Set<number>();

  // Collect all downstream activities in topological order
  const toProcess: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const successors = succMap.get(current) ?? [];
    for (const dep of successors) {
      const succRid = dep.successor_jsa_rid;
      if (!state.has(succRid)) continue;
      if (!affected.has(succRid)) {
        affected.add(succRid);
        toProcess.push(succRid);
      }
      if (!visited.has(succRid)) {
        queue.push(succRid);
      }
    }
  }

  // Process cascaded activities — recalculate from predecessors
  for (const jsaRid of toProcess) {
    if (directEdits.has(jsaRid)) continue; // skip direct edits

    const current = state.get(jsaRid);
    if (!current) continue;
    const act = actMap.get(jsaRid)!;
    const preds = predMap.get(jsaRid) ?? [];

    // Find the most constraining predecessor
    let latestStart: string | null = null;
    let sourceJsa: number | null = null;

    for (const dep of preds) {
      const predState = state.get(dep.predecessor_jsa_rid);
      if (!predState) continue;

      let baseDate: string;
      if (dep.dependency_type === "FS") {
        baseDate = predState.end;
      } else {
        // SS
        baseDate = predState.start;
      }

      // Add lag days (workdays)
      let calcStart: string;
      if (dep.dependency_type === "FS") {
        // FS: successor starts lag workdays after predecessor ends
        calcStart = dep.lag_days === 0
          ? calendar.addWorkdays(baseDate, 1)
          : calendar.addWorkdays(baseDate, dep.lag_days);
      } else {
        // SS: successor starts lag workdays after predecessor starts
        calcStart = dep.lag_days === 0
          ? baseDate
          : calendar.addWorkdays(baseDate, dep.lag_days);
      }

      calcStart = calendar.nextWorkday(calcStart);

      if (latestStart === null || calcStart > latestStart) {
        latestStart = calcStart;
        sourceJsa = dep.predecessor_jsa_rid;
      }
    }

    if (latestStart === null) continue;

    // Only cascade if the start date actually changed
    if (latestStart === current.start) continue;

    const newEnd = calendar.calcEndDate(latestStart, current.duration);

    // Find the original direct edit that triggered this cascade
    let rootSource = sourceJsa;
    if (rootSource && !directEdits.has(rootSource)) {
      // Walk up to find a direct edit source from our changes
      for (const c of changes) {
        if (c.jsa_rid === rootSource && c.source_jsa_rid !== null) {
          rootSource = c.source_jsa_rid;
          break;
        }
      }
    }

    changes.push({
      jsa_rid: jsaRid,
      field_name: "start_date",
      old_value: act.current_start_date,
      new_value: latestStart,
      is_direct_edit: false,
      source_jsa_rid: rootSource,
    });

    if (newEnd !== current.end) {
      changes.push({
        jsa_rid: jsaRid,
        field_name: "end_date",
        old_value: act.current_end_date,
        new_value: newEnd,
        is_direct_edit: false,
        source_jsa_rid: rootSource,
      });
    }

    // Update state for further cascading
    state.set(jsaRid, { start: latestStart, end: newEnd, duration: current.duration });
  }

  return changes;
}
