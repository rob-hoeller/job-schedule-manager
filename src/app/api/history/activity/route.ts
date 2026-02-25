import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient } from "@/lib/schedule-data";

/**
 * GET /api/history/activity?jsa_rid=X — Change records for a specific activity
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const jsaRid = request.nextUrl.searchParams.get("jsa_rid");
  if (!jsaRid) return badRequest("Missing jsa_rid parameter");

  const sb = getServiceClient();

  const { data, error } = await sb
    .from("change_records")
    .select(`
      *,
      publish_events (
        publish_event_rid,
        user_id,
        published_at,
        publish_note,
        move_types,
        change_count,
        direct_edit_count,
        cascaded_count
      )
    `)
    .eq("jsa_rid", parseInt(jsaRid))
    .order("changed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user display names
  const userIds = [...new Set((data ?? []).map((r) => r.publish_events?.user_id).filter(Boolean))];
  const { data: profiles } = await sb
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const enriched = (data ?? []).map((r) => ({
    ...r,
    user_display_name: nameMap.get(r.publish_events?.user_id) ?? "Unknown",
  }));

  return NextResponse.json({ records: enriched });
}
