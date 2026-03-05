import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient } from "@/lib/schedule-data";

/**
 * GET /api/history/job?schedule_rid=X — Full job history: publish events with all change records
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const scheduleRid = request.nextUrl.searchParams.get("schedule_rid");
  if (!scheduleRid) return badRequest("Missing schedule_rid parameter");

  const sb = getServiceClient();

  // Load all publish events for this schedule
  const { data: events, error: evErr } = await sb
    .from("publish_events")
    .select("*")
    .eq("job_schedule_rid", parseInt(scheduleRid))
    .order("published_at", { ascending: false });

  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (!events || events.length === 0) return NextResponse.json({ events: [] });

  const eventRids = events.map((e) => e.publish_event_rid);

  // Load ALL change records for these events in one query
  const { data: records, error: recErr } = await sb
    .from("change_records")
    .select("*")
    .in("publish_event_rid", eventRids)
    .order("changed_at");

  if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

  // Get activity descriptions
  const jsaRids = [...new Set((records ?? []).map((r) => r.jsa_rid))];
  const { data: activities } = await sb
    .from("job_schedule_activities")
    .select("jsa_rid, description")
    .in("jsa_rid", jsaRids.length > 0 ? jsaRids : [0]);

  const descMap = new Map((activities ?? []).map((a) => [a.jsa_rid, a.description]));

  // Get user display names
  const userIds = [...new Set(events.map((e) => e.user_id))];
  const { data: profiles } = await sb
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  // Group records by publish event — exclude status-only changes
  const recordsByEvent = new Map<string, typeof records>();
  for (const r of records ?? []) {
    if (r.field_name === "status") continue;
    const arr = recordsByEvent.get(r.publish_event_rid) ?? [];
    arr.push(r);
    recordsByEvent.set(r.publish_event_rid, arr);
  }

  // Build enriched response — skip events with no schedule-move records
  const enriched = events.filter((e) => (recordsByEvent.get(e.publish_event_rid) ?? []).length > 0).map((e) => {
    const eventRecords = recordsByEvent.get(e.publish_event_rid) ?? [];
    const directEdits = eventRecords.filter((r) => r.is_direct_edit);
    const cascaded = eventRecords.filter((r) => !r.is_direct_edit);

    // Find Settlement impact — look for Settlement end_date change
    let settlementImpact: { oldDate: string; newDate: string; diffDays: number } | null = null;
    for (const r of eventRecords) {
      const desc = descMap.get(r.jsa_rid);
      if (desc === "Settlement" && r.field_name === "end_date" && r.old_value && r.new_value) {
        const oldD = new Date(r.old_value + "T12:00:00");
        const newD = new Date(r.new_value + "T12:00:00");
        const diff = Math.round((newD.getTime() - oldD.getTime()) / (1000 * 60 * 60 * 24));
        if (diff !== 0) {
          settlementImpact = { oldDate: r.old_value, newDate: r.new_value, diffDays: diff };
        }
        break;
      }
    }

    return {
      ...e,
      user_display_name: nameMap.get(e.user_id) ?? "Unknown",
      settlement_impact: settlementImpact,
      direct_edits: directEdits.map((r) => ({
        ...r,
        activity_description: descMap.get(r.jsa_rid) ?? "Unknown",
      })),
      cascaded_changes: cascaded.map((r) => ({
        ...r,
        activity_description: descMap.get(r.jsa_rid) ?? "Unknown",
      })),
    };
  });

  return NextResponse.json({ events: enriched });
}
