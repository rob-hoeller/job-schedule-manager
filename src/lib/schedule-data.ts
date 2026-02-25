import { createClient } from "@supabase/supabase-js";
import type { ActivitySnapshot, DependencyRecord, CalendarDayEntry } from "./cascade-engine";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export { getServiceClient };

export async function loadScheduleData(scheduleRid: number) {
  const sb = getServiceClient();

  const [actResult, depResult, calResult] = await Promise.all([
    sb
      .from("job_schedule_activities")
      .select("jsa_rid, schedule_rid, current_start_date, current_end_date, current_duration")
      .eq("schedule_rid", scheduleRid),
    sb
      .from("job_schedule_activity_dependencies")
      .select("predecessor_jsa_rid, successor_jsa_rid, dependency_type, lag_days")
      .eq("schedule_rid", scheduleRid),
    sb
      .from("calendar_days")
      .select("day_date, is_workday")
      .order("day_date"),
  ]);

  if (actResult.error) throw new Error(`Failed to load activities: ${actResult.error.message}`);
  if (depResult.error) throw new Error(`Failed to load dependencies: ${depResult.error.message}`);
  if (calResult.error) throw new Error(`Failed to load calendar: ${calResult.error.message}`);

  return {
    activities: actResult.data as ActivitySnapshot[],
    dependencies: depResult.data as DependencyRecord[],
    calendarDays: calResult.data as CalendarDayEntry[],
  };
}
