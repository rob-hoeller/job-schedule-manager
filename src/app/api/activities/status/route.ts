import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient } from "@/lib/schedule-data";

/**
 * POST /api/activities/status — Immediate status update (no staging)
 * Body: { jsa_rid: number, schedule_rid: number, status: string, publish_note: string }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { jsa_rid, schedule_rid, status, publish_note } = body;

  if (!jsa_rid || !schedule_rid || !status) return badRequest("Missing required fields");
  if (status !== "Completed" && status !== "Approved") {
    return badRequest("Status must be 'Completed' or 'Approved'");
  }

  const sb = getServiceClient();

  // Get current status
  const { data: activity, error: fetchError } = await sb
    .from("job_schedule_activities")
    .select("status")
    .eq("jsa_rid", jsa_rid)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!activity) return badRequest("Activity not found");

  const oldStatus = activity.status;
  if (oldStatus === status) return badRequest("Status is already " + status);
  if (oldStatus === "Approved") return badRequest("Cannot change status — activity is already Approved");

  // Create publish event
  const { data: publishEvent, error: pubError } = await sb
    .from("publish_events")
    .insert({
      user_id: user.id,
      job_schedule_rid: schedule_rid,
      publish_note: publish_note?.trim() || `Status changed to ${status}`,
      move_types: ["status_update"],
      change_count: 1,
      direct_edit_count: 1,
      cascaded_count: 0,
    })
    .select()
    .single();

  if (pubError) return NextResponse.json({ error: pubError.message }, { status: 500 });

  // Log change record
  await sb.from("change_records").insert({
    publish_event_rid: publishEvent.publish_event_rid,
    jsa_rid,
    job_schedule_rid: schedule_rid,
    field_name: "status",
    old_value: oldStatus,
    new_value: status,
    is_direct_edit: true,
    source_jsa_rid: null,
  });

  // Update the activity
  const now = new Date().toISOString();
  const { error: updateError } = await sb
    .from("job_schedule_activities")
    .update({
      status,
      last_modified_by: user.id,
      last_modified_at: now,
    })
    .eq("jsa_rid", jsa_rid);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    message: "Status updated",
    publish_event_rid: publishEvent.publish_event_rid,
    old_status: oldStatus,
    new_status: status,
  });
}
