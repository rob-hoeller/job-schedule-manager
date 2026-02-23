import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient } from "@/lib/schedule-data";

/**
 * POST /api/staging/publish — Publish all staged changes atomically
 * Body: { schedule_rid: number, publish_note: string }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { schedule_rid, publish_note } = body;

  if (!schedule_rid) return badRequest("Missing schedule_rid");
  if (!publish_note || !publish_note.trim()) return badRequest("Publish note is required");

  const sb = getServiceClient();

  // Load staged changes for this user + schedule
  const { data: staged, error: loadError } = await sb
    .from("staged_changes")
    .select("*")
    .eq("user_id", user.id)
    .eq("job_schedule_rid", schedule_rid);

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!staged || staged.length === 0) return badRequest("No staged changes to publish");

  const directCount = staged.filter((s) => s.is_direct_edit).length;
  const cascadedCount = staged.filter((s) => !s.is_direct_edit).length;
  const moveTypes = [...new Set(staged.map((s) => s.move_type))];

  // 1. Create publish event
  const { data: publishEvent, error: pubError } = await sb
    .from("publish_events")
    .insert({
      user_id: user.id,
      job_schedule_rid: schedule_rid,
      publish_note: publish_note.trim(),
      move_types: moveTypes,
      change_count: staged.length,
      direct_edit_count: directCount,
      cascaded_count: cascadedCount,
    })
    .select()
    .single();

  if (pubError) return NextResponse.json({ error: pubError.message }, { status: 500 });

  // 2. Insert change records
  const changeRecords = staged.map((s) => ({
    publish_event_rid: publishEvent.publish_event_rid,
    jsa_rid: s.jsa_rid,
    job_schedule_rid: schedule_rid,
    field_name: s.field_name,
    old_value: s.original_value,
    new_value: s.staged_value,
    is_direct_edit: s.is_direct_edit,
    source_jsa_rid: s.source_jsa_rid,
  }));

  const { error: crError } = await sb.from("change_records").insert(changeRecords);
  if (crError) return NextResponse.json({ error: crError.message }, { status: 500 });

  // 3. Apply changes to live job_schedule_activities
  // Group changes by jsa_rid
  const changesByJsa = new Map<number, Map<string, string>>();
  for (const s of staged) {
    if (!changesByJsa.has(s.jsa_rid)) changesByJsa.set(s.jsa_rid, new Map());
    changesByJsa.get(s.jsa_rid)!.set(s.field_name, s.staged_value);
  }

  const now = new Date().toISOString();
  const errors: string[] = [];

  for (const [jsaRid, fields] of changesByJsa) {
    const update: Record<string, unknown> = {
      last_modified_by: user.id,
      last_modified_at: now,
    };

    for (const [field, value] of fields) {
      if (field === "start_date") update.current_start_date = value;
      else if (field === "end_date") update.current_end_date = value;
      else if (field === "duration") update.current_duration = parseInt(value);
      else if (field === "status") update.status = value;
    }

    const { error: updateError } = await sb
      .from("job_schedule_activities")
      .update(update)
      .eq("jsa_rid", jsaRid);

    if (updateError) errors.push(`jsa_rid ${jsaRid}: ${updateError.message}`);
  }

  // 4. Clear staging
  await sb
    .from("staged_changes")
    .delete()
    .eq("user_id", user.id)
    .eq("job_schedule_rid", schedule_rid);

  if (errors.length > 0) {
    return NextResponse.json({
      message: "Published with some errors",
      publish_event_rid: publishEvent.publish_event_rid,
      errors,
    }, { status: 207 });
  }

  return NextResponse.json({
    message: "Published successfully",
    publish_event_rid: publishEvent.publish_event_rid,
    change_count: staged.length,
    direct_count: directCount,
    cascaded_count: cascadedCount,
  });
}
