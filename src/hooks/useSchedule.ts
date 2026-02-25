"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Activity, Dependency } from "@/types";

async function fetchAll<T>(table: string, column: string, value: number): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(column, value)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as T[]));
    done = (data?.length ?? 0) < pageSize;
    from += pageSize;
  }
  return rows;
}

export function useSchedule(scheduleRid: number | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitial, setIsInitial] = useState(true);

  /** Silent refresh — updates data in place without loading flash */
  const refresh = useCallback(() => {
    if (!scheduleRid) return;
    Promise.all([
      fetchAll<Activity>("job_schedule_activities", "schedule_rid", scheduleRid),
      fetchAll<Dependency>("job_schedule_activity_dependencies", "schedule_rid", scheduleRid),
    ])
      .then(([acts, deps]) => {
        acts.sort((a, b) => (a.current_start_date ?? "").localeCompare(b.current_start_date ?? ""));
        setActivities(acts);
        setDependencies(deps);
      })
      .catch((e) => setError(e.message));
  }, [scheduleRid]);

  useEffect(() => {
    if (!scheduleRid) {
      setActivities([]);
      setDependencies([]);
      setIsInitial(true);
      return;
    }

    setLoading(true);
    setError(null);
    setIsInitial(true);

    Promise.all([
      fetchAll<Activity>("job_schedule_activities", "schedule_rid", scheduleRid),
      fetchAll<Dependency>("job_schedule_activity_dependencies", "schedule_rid", scheduleRid),
    ])
      .then(([acts, deps]) => {
        acts.sort((a, b) => (a.current_start_date ?? "").localeCompare(b.current_start_date ?? ""));
        setActivities(acts);
        setDependencies(deps);
        setIsInitial(false);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [scheduleRid]);

  return { activities, dependencies, loading: loading && isInitial, error, refresh };
}
