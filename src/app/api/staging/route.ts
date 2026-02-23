import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient, loadScheduleData } from "@/lib/schedule-data";
import { WorkdayCalendar, calculateCascade } from "@/lib/cascade-engine";

/**
 * POST /api/staging — Stage a Move Start or Change Duration edit
 * Body: { jsa_rid: number, schedule_rid: number, move_type: "move_start" | "change_duration", value: string | number }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { jsa_rid, schedule_rid, move_type, value } = body;

  if (!jsa_rid || !schedule_rid || !move_type || value === undefined) {
    return badRequest("Missing required fields: jsa_rid, schedule_rid, move_type, value");
  }
  if (move_type !== "move_start" && move_type !== "change_duration") {
    return badRequest("move_type must be 'move_start' or 'change_duration'");
  }

  const sb = getServiceClient();

  // Load schedule data
  const { activities, dependencies, calendarDays } = await loadScheduleData(schedule_rid);
  const calendar = new WorkdayCalendar(calendarDays);

  // Load existing staged changes for this user+schedule to build full edit set
  const { data: existingStaged } = await sb
    .from("staged_changes")
    .select("*")
    .eq("user_id", user.id)
    .eq("job_schedule_rid", schedule_rid);

  // Build direct edits map: merge existing staged direct edits with new edit
  const directEdits = new Map<number, { move_type: "move_start" | "change_duration"; value: string | number }>();

  // Re-apply existing direct edits (except for the activity being edited now — new edit replaces)
  if (existingStaged) {
    const directJsas = new Set<number>();
    for (const s of existingStaged) {
      if (s.is_direct_edit) directJsas.add(s.jsa_rid);
    }
    for (const jsaRid of directJsas) {
      if (jsaRid === jsa_rid) continue; // skip — will be replaced by new edit
      const fields = existingStaged.filter((s) => s.jsa_rid === jsaRid && s.is_direct_edit);
      const moveType = fields[0]?.move_type as "move_start" | "change_duration";
      if (moveType === "move_start") {
        const startField = fields.find((f) => f.field_name === "start_date");
        if (startField) directEdits.set(jsaRid, { move_type: "move_start", value: startField.staged_value });
      } else if (moveType === "change_duration") {
        const durField = fields.find((f) => f.field_name === "duration");
        if (durField) directEdits.set(jsaRid, { move_type: "change_duration", value: parseInt(durField.staged_value) });
      }
    }
  }

  // Add the new edit
  directEdits.set(jsa_rid, { move_type, value });

  // Calculate full cascade
  const changes = calculateCascade(directEdits, activities, dependencies, calendar);

  if (changes.length === 0) {
    return NextResponse.json({ message: "No changes detected", changes: [] });
  }

  // Clear existing staged changes for this user+schedule
  await sb
    .from("staged_changes")
    .delete()
    .eq("user_id", user.id)
    .eq("job_schedule_rid", schedule_rid);

  // Insert all new staged changes
  const rows = changes.map((c) => ({
    user_id: user.id,
    job_schedule_rid: schedule_rid,
    jsa_rid: c.jsa_rid,
    move_type: c.is_direct_edit
      ? directEdits.get(c.jsa_rid)?.move_type ?? move_type
      : (directEdits.get(c.source_jsa_rid!)?.move_type ?? move_type),
    field_name: c.field_name,
    original_value: c.old_value,
    staged_value: c.new_value,
    is_direct_edit: c.is_direct_edit,
    source_jsa_rid: c.source_jsa_rid,
  }));

  const { error: insertError } = await sb.from("staged_changes").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const directCount = changes.filter((c) => c.is_direct_edit).length;
  const cascadedCount = changes.filter((c) => !c.is_direct_edit).length;

  return NextResponse.json({
    message: "Changes staged successfully",
    direct_count: directCount,
    cascaded_count: cascadedCount,
    total_count: changes.length,
    changes,
  });
}

/**
 * GET /api/staging?schedule_rid=X — Get all staged changes for current user + schedule
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const scheduleRid = request.nextUrl.searchParams.get("schedule_rid");
  if (!scheduleRid) return badRequest("Missing schedule_rid parameter");

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("staged_changes")
    .select("*")
    .eq("user_id", user.id)
    .eq("job_schedule_rid", parseInt(scheduleRid))
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ changes: data });
}

/**
 * DELETE /api/staging?schedule_rid=X — Discard all staged changes for current user + schedule
 */
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const scheduleRid = request.nextUrl.searchParams.get("schedule_rid");
  if (!scheduleRid) return badRequest("Missing schedule_rid parameter");

  const sb = getServiceClient();
  const { error } = await sb
    .from("staged_changes")
    .delete()
    .eq("user_id", user.id)
    .eq("job_schedule_rid", parseInt(scheduleRid));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "All staged changes discarded" });
}
