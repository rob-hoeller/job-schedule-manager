import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient } from "@/lib/schedule-data";

/**
 * GET /api/history/schedule?schedule_rid=X — Publish events for a schedule
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const scheduleRid = request.nextUrl.searchParams.get("schedule_rid");
  if (!scheduleRid) return badRequest("Missing schedule_rid parameter");

  const sb = getServiceClient();

  const { data, error } = await sb
    .from("publish_events")
    .select("*")
    .eq("job_schedule_rid", parseInt(scheduleRid))
    .order("published_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user display names
  const userIds = [...new Set((data ?? []).map((e) => e.user_id))];
  const { data: profiles } = await sb
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const enriched = (data ?? []).map((e) => ({
    ...e,
    user_display_name: nameMap.get(e.user_id) ?? "Unknown",
  }));

  return NextResponse.json({ events: enriched });
}
