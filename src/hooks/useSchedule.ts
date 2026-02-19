"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Activity, Dependency } from "@/types";

export function useSchedule(scheduleRid: number | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleRid) {
      setActivities([]);
      setDependencies([]);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      supabase
        .from("job_schedule_activities")
        .select("*")
        .eq("schedule_rid", scheduleRid)
        .order("current_start_date"),
      supabase
        .from("job_schedule_activity_dependencies")
        .select("*")
        .eq("schedule_rid", scheduleRid),
    ]).then(([actRes, depRes]) => {
      if (actRes.error) setError(actRes.error.message);
      else setActivities(actRes.data ?? []);

      if (depRes.error) setError(depRes.error.message);
      else setDependencies(depRes.data ?? []);

      setLoading(false);
    });
  }, [scheduleRid]);

  return { activities, dependencies, loading, error };
}
