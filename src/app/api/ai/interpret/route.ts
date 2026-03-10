import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth-helpers";
import { getServiceClient } from "@/lib/schedule-data";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(
  activities: { jsa_rid: number; description: string; current_start_date: string | null; current_end_date: string | null; current_duration: number | null; status: string }[],
  today: string,
  selectedJsaRid: number | null,
): string {
  const activityList = activities
    .map((a) => `  - jsa_rid=${a.jsa_rid} | "${a.description}" | start=${a.current_start_date} | end=${a.current_end_date} | duration=${a.current_duration}d | status=${a.status}`)
    .join("\n");

  const selectedActivity = selectedJsaRid ? activities.find((a) => a.jsa_rid === selectedJsaRid) : null;
  const selectedCtx = selectedActivity
    ? `\nSELECTED ACTIVITY: jsa_rid=${selectedActivity.jsa_rid} | "${selectedActivity.description}" | start=${selectedActivity.current_start_date} | end=${selectedActivity.current_end_date} | duration=${selectedActivity.current_duration}d | status=${selectedActivity.status}\nIf the user says "it", "this", "this activity", "the selected one", or similar pronouns without naming a specific activity, they mean the selected activity above.`
    : "\nNo activity is currently selected. If the user says \"it\" or \"this\" without context, ask which activity they mean.";

  return `You are a construction schedule editing assistant. You help users make changes to their job schedule by interpreting plain English requests into structured actions.

TODAY'S DATE: ${today}
WORKDAYS: Monday through Friday only. Weekends and holidays are non-workdays.${selectedCtx}

CURRENT SCHEDULE (${activities.length} activities):
${activityList}

AVAILABLE ACTIONS:
1. "move_start" — Move an activity's start date. Preserves duration, end date adjusts. Value = new start date (YYYY-MM-DD, must be a workday).
2. "change_duration" — Change an activity's duration. Preserves start date, end date adjusts. Value = new duration (integer, workdays).
3. "set_status" — Update an activity's status. Value = "Completed" or "Approved".
   - Status transitions: Released → Completed OR Approved. Completed → Approved only. Approved = locked (cannot change).
   - Cannot move/edit Approved activities.

DIRECTION RULES (CRITICAL — construction scheduling context):
- "move forward", "push forward", "push", "push out", "delay" → move LATER in time (higher date)
- "move back", "pull back", "pull", "move up", "move earlier" → move EARLIER in time (lower date)
- "forward" ALWAYS means later in the timeline, never earlier
- "back" ALWAYS means earlier in the timeline, never later
- When in doubt about direction, ask for clarification rather than guessing
- "Extend by N days" means change_duration, adding N to the current duration.
- "Shorten by N days" means change_duration, subtracting N from the current duration.
- All dates must be workdays (Mon-Fri). If a calculated date falls on a weekend, use the next workday (Monday).
- RELATIVE DATE RESOLUTION (always resolve relative to TODAY = ${today}):
  - "next Monday/Tuesday/etc." → the upcoming occurrence of that weekday after today
  - "in N days" or "N days from now" → add N calendar days to today, snap to workday
  - "N weeks" or "in N weeks" → add N*7 calendar days to today, snap to workday
  - "push/delay N days" → add N WORKDAYS to the activity's current start date (skip weekends)
  - "pull/move up N days" → subtract N WORKDAYS from the activity's current start date (skip weekends)
  - "end of the month" → last workday of the current month
  - "beginning of [month]" → first workday of that month
  - When adding/subtracting workdays, count only Mon-Fri days (skip Sat/Sun).
- If the user's request is ambiguous (multiple activities match, missing info), set type="clarification" and ask.
- If the request doesn't map to any schedule action, set type="error" with a helpful suggestion.
- For questions about the schedule (dates, durations, what's late, etc.), set type="answer" and provide the answer.
- An activity is "late" if its status is "Released" and its current_end_date < today.
- When mentioning dates in answers, use readable format like "Jun 11" (month abbreviation + day). Only include the year if it differs from the current year. Never use YYYY-MM-DD format in answers.

RESPOND WITH VALID JSON ONLY matching one of these schemas:

Action response:
{
  "type": "action",
  "interpretation": "Brief description of what you understood",
  "actions": [
    {
      "jsa_rid": <number>,
      "activity_description": "<name>",
      "action_type": "move_start" | "change_duration" | "set_status",
      "current_value": "<current date/duration/status before the change>",
      "value": "<new date string or number or status string>",
      "explanation": "Brief explanation"
    }
  ]
}

Answer response (for questions):
{
  "type": "answer",
  "interpretation": "What the user asked",
  "answer": "Your answer in plain English"
}

Clarification response:
{
  "type": "clarification",
  "interpretation": "What you think they meant",
  "message": "Your question to the user",
  "options": ["Option 1", "Option 2"]
}

Error response:
{
  "type": "error",
  "message": "What went wrong and a helpful suggestion"
}`;
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { message, schedule_rid, selected_jsa_rid, conversation_history } = body;

  if (!message || !schedule_rid) return badRequest("Missing message or schedule_rid");

  const startMs = Date.now();
  const sb = getServiceClient();

  // Load schedule activities
  const { data: activities, error: actErr } = await sb
    .from("job_schedule_activities")
    .select("jsa_rid, description, current_start_date, current_end_date, current_duration, status")
    .eq("schedule_rid", schedule_rid)
    .order("current_start_date");

  if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 });
  if (!activities || activities.length === 0) {
    return NextResponse.json({ error: "No activities found for this schedule" }, { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = buildSystemPrompt(activities, today, selected_jsa_rid ?? null);

  // Build message history for conversation context
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history (last 10 messages max)
  const history: ConversationMessage[] = (conversation_history ?? []).slice(-10);
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: message });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { type: "error", message: "Failed to parse AI response. Please try again." };
    }

    // Validate actions
    if (parsed.type === "action" && Array.isArray(parsed.actions)) {
      const actByRid = new Map(activities.map((a) => [a.jsa_rid, a]));
      const validatedActions = [];
      const warnings: string[] = [];

      for (const action of parsed.actions as Array<{ jsa_rid: number; action_type: string; value: string | number }>) {
        const act = actByRid.get(action.jsa_rid);
        if (!act) {
          parsed = { type: "error", message: `Could not find activity with ID ${action.jsa_rid}. Please try rephrasing your request.` };
          break;
        }

        // Validate status transitions
        if (action.action_type === "set_status") {
          const status = action.value as string;
          if (act.status === "Approved") {
            warnings.push(`${act.description} is already Approved (locked)`);
            continue; // skip this action
          }
          if (act.status === "Completed" && status === "Completed") {
            warnings.push(`${act.description} is already Completed`);
            continue;
          }
          if (act.status === "Completed" && status !== "Approved") {
            warnings.push(`${act.description} is Completed — can only be Approved, not reverted`);
            continue;
          }
        }

        // Validate move actions don't target locked activities
        if ((action.action_type === "move_start" || action.action_type === "change_duration") &&
            (act.status === "Approved" || act.status === "Completed")) {
          warnings.push(`${act.description} is ${act.status} and cannot be moved`);
          continue;
        }

        validatedActions.push(action);
      }

      if (parsed.type === "action") {
        (parsed as Record<string, unknown>).actions = validatedActions;
        if (warnings.length > 0) {
          (parsed as Record<string, unknown>).interpretation =
            ((parsed.interpretation as string) ?? "") + "\n\n⚠️ Skipped: " + warnings.join("; ");
        }
        if (validatedActions.length === 0 && warnings.length > 0) {
          parsed = { type: "error", message: "No valid actions: " + warnings.join("; ") };
        }
      }
    }

    const durationMs = Date.now() - startMs;
    const usage = completion.usage;

    // Log to chat_interactions
    try {
      await sb.from("chat_interactions").insert({
        user_id: user.id,
        job_schedule_rid: schedule_rid,
        user_message: message,
        ai_response: parsed,
        model_used: "gpt-4o",
        input_tokens: usage?.prompt_tokens ?? null,
        output_tokens: usage?.completion_tokens ?? null,
        cost_usd: usage ? ((usage.prompt_tokens ?? 0) * 2.5 / 1_000_000) + ((usage.completion_tokens ?? 0) * 10 / 1_000_000) : null,
        duration_ms: durationMs,
      });
    } catch (logErr) {
      // Non-fatal — don't fail the request if logging fails
      console.error("Failed to log chat interaction:", logErr);
    }

    return NextResponse.json({
      ...parsed,
      _meta: {
        model: "gpt-4o",
        duration_ms: durationMs,
        tokens: usage ? { input: usage.prompt_tokens, output: usage.completion_tokens } : null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ type: "error", message: `AI service error: ${message}` }, { status: 500 });
  }
}
