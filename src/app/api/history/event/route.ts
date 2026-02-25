import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient } from "@/lib/schedule-data";

/**
 * GET /api/history/event?publish_event_rid=X — All change records in a publish event
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const eventRid = request.nextUrl.searchParams.get("publish_event_rid");
  if (!eventRid) return badRequest("Missing publish_event_rid parameter");

  const sb = getServiceClient();

  // Load publish event
  const { data: event, error: eventError } = await sb
    .from("publish_events")
    .select("*")
    .eq("publish_event_rid", eventRid)
    .single();

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });

  // Load change records
  const { data: records, error: recError } = await sb
    .from("change_records")
    .select("*")
    .eq("publish_event_rid", eventRid)
    .order("changed_at");

  if (recError) return NextResponse.json({ error: recError.message }, { status: 500 });

  // Get user display name
  const { data: profile } = await sb
    .from("user_profiles")
    .select("display_name")
    .eq("id", event.user_id)
    .single();

  // Get activity descriptions for the affected jsa_rids
  const jsaRids = [...new Set((records ?? []).map((r) => r.jsa_rid))];
  const { data: activities } = await sb
    .from("job_schedule_activities")
    .select("jsa_rid, description")
    .in("jsa_rid", jsaRids);

  const descMap = new Map((activities ?? []).map((a) => [a.jsa_rid, a.description]));

  const enrichedRecords = (records ?? []).map((r) => ({
    ...r,
    activity_description: descMap.get(r.jsa_rid) ?? "Unknown",
  }));

  return NextResponse.json({
    event: {
      ...event,
      user_display_name: profile?.display_name ?? "Unknown",
    },
    records: enrichedRecords,
  });
}
