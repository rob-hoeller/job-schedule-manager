# Phase 3: Natural Language Schedule Editor

**Version:** 1.0 (Draft)  
**Date:** March 5, 2026  
**Author:** Sherlock  
**Status:** Draft — Pending Rob's Review

---

## Executive Summary

Add a plain-language interface to the Job Schedule Manager that lets users describe schedule changes in natural English. An AI layer interprets the request, resolves it to specific activities and move types, and stages the changes for the user to review and publish through the existing workflow. The user never loses control — AI proposes, human approves.

---

## User Experience Flow

```
User taps 💬 button → types "Push drywall back 3 days"
  → AI interprets: Move Start on "Drywall Install", +3 workdays
  → System stages the change + cascades
  → User sees familiar staging toolbar with settlement impact
  → User reviews, adjusts if needed, publishes
```

**The AI is a translator, not a decision-maker.** It converts English into the same Move Start / Change Duration operations that already exist. Everything downstream (cascade engine, staging, publish) is unchanged.

---

## Functional Requirements

### FR-1: Chat Input Interface
**Priority:** P0

- **Trigger:** A button (💬 or similar) in the toolbar area, always visible when a job is loaded
- **Input:** Opens a text box (modal or inline panel) where the user types their request
- **Submit:** Enter key or Send button submits the request
- **Loading state:** Show a brief "thinking" indicator while the AI processes
- **Mobile-friendly:** Full-width input on mobile, constrained width on desktop

### FR-2: AI Interpretation Layer
**Priority:** P0

The AI receives the user's text plus schedule context, and returns a structured action plan.

**Input to AI:**
```json
{
  "user_message": "Push drywall back 3 days",
  "activities": [
    { "jsa_rid": 123, "description": "Drywall Install", "current_start_date": "2026-05-01", "current_end_date": "2026-05-07", "current_duration": 5, "status": "Released" }
  ],
  "today": "2026-03-05"
}
```

**Output from AI (structured JSON):**
```json
{
  "type": "action",
  "interpretation": "Move the start date of Drywall Install forward by 3 workdays",
  "actions": [
    {
      "jsa_rid": 123,
      "activity_description": "Drywall Install",
      "action_type": "move_start",
      "value": "2026-05-06",
      "explanation": "Current start 2026-05-01 + 3 workdays = 2026-05-06"
    }
  ],
  "confidence": "high",
  "clarification_needed": null
}
```

**Status change example:**
```json
{
  "type": "action",
  "interpretation": "Mark Install Windows as Completed",
  "actions": [
    {
      "jsa_rid": 456,
      "activity_description": "Install Windows",
      "action_type": "set_status",
      "value": "Completed",
      "explanation": "Current status: Released → Completed"
    }
  ],
  "confidence": "high",
  "clarification_needed": null
}
```

**Query example (no actions, just an answer):**
```json
{
  "type": "answer",
  "interpretation": "User asked when settlement is scheduled",
  "answer": "Settlement is currently scheduled for June 12, 2026.",
  "actions": [],
  "confidence": "high",
  "clarification_needed": null
}
```

**AI must return structured JSON only — no freeform text goes into the staging system.**

### FR-3: Confirmation Step
**Priority:** P0

Before staging, show the user what the AI interpreted:

```
📝 Here's what I understood:

  Move Start: Drywall Install
  New start date: May 6, 2026 (currently May 1)
  
  [Stage Changes]  [Cancel]  [Try Again]
```

- **Stage Changes** — feeds the actions into the existing staging system (cascade runs automatically)
- **Cancel** — closes the dialog, nothing happens
- **Try Again** — clears and lets the user rephrase

This is a mandatory step. The AI never stages directly.

### FR-4: Ambiguity Handling
**Priority:** P0

When the AI can't confidently resolve the request:

**Ambiguous activity name:**
> User: "Push framing back a week"  
> AI finds: "Framing - 1st Floor", "Framing - 2nd Floor", "Framing - Garage"  
> Response: "Which framing activity? [1st Floor] [2nd Floor] [Garage] [All]"

**Unclear direction:**
> User: "Move settlement to June"  
> AI: "Move Settlement start date to June 2, 2026? (first workday in June)"  
> User confirms or clarifies

**Missing information:**
> User: "Extend the drywall"  
> AI: "By how many days would you like to extend Drywall Install? (currently 5 days)"

**Unrecognizable request:**
> User: "Make it rain"  
> AI: "I couldn't map that to a schedule change. Try something like 'Push drywall back 3 days' or 'Extend framing by a week'."

### FR-5: Multi-Action Requests
**Priority:** P1

Support requests that imply multiple changes:

> "Push everything after drywall back 5 days"  
> → Move Start on all successors of Drywall Install, +5 workdays each

> "Extend framing by 3 days and push drywall start to May 10"  
> → Change Duration on Framing + Move Start on Drywall Install

All actions shown in the confirmation step before staging.

### FR-6: Smart Context
**Priority:** P1

The AI should understand contextual references:

- **"Push it back 3 days"** — if user has an activity selected/open in the edit panel, "it" refers to that activity
- **"Move the next activity after framing"** — resolve via dependency chain
- **Relative dates:** "push to next Monday", "delay 2 weeks", "move to after Memorial Day"
- **Status awareness:** Warn if the user tries to move an Approved or Completed activity

### FR-7: Conversation History (Within Session)
**Priority:** P2

Keep a short conversation context within the chat session so the user can refine:

> User: "Push drywall back 3 days"  
> AI stages it  
> User: "Actually make that 5 days"  
> AI understands "that" = the drywall move, adjusts

Context resets when the chat is closed or the user switches jobs.

---

## Technical Architecture

### API Route

```
POST /api/ai/interpret
```

**Request body:**
```json
{
  "message": "Push drywall back 3 days",
  "schedule_rid": 12345,
  "selected_jsa_rid": null,
  "conversation_history": []
}
```

**The API route:**
1. Loads current schedule activities (descriptions, dates, durations, statuses)
2. Builds a system prompt with activity context + workday calendar awareness
3. Calls the AI model with structured output (JSON mode)
4. Validates the response (jsa_rids exist, move types valid, dates are workdays)
5. Returns the interpretation + proposed actions to the client

### AI Model Selection

**Options to consider:**

| Model | Pros | Cons |
|---|---|---|
| **GPT-4o-mini** | Cheap (~$0.001/call), fast, good at structured JSON | May struggle with complex multi-activity requests |
| **GPT-4o** | Better reasoning, handles ambiguity well | ~$0.01/call, slightly slower |
| **Claude Haiku** | Fast, cheap, good instruction following | Requires Anthropic key |

**Decision:** Start with **GPT-4o** for best accuracy during POC. This is not a production-scale app yet — accuracy matters more than cost optimization at this stage. Can drop to GPT-4o-mini later if cost becomes a concern.

**Estimated cost per interaction:** ~$0.01–0.03 with GPT-4o, well under $0.05 even for multi-turn conversations.

### System Prompt Design

The system prompt includes:
1. Role: "You are a schedule editor assistant"
2. Available actions: Move Start, Change Duration, Set Status (definitions + rules)
3. Current activity list with dates/durations/statuses
4. Calendar awareness: workdays only, skip weekends/holidays
5. Output format: strict JSON schema
6. Constraint: Approved/Completed activities cannot be moved
7. Disambiguation rules: ask rather than guess

**Activity context is injected per-request** — always reflects the current live schedule plus any staged changes.

### Client-Side Flow

```
ChatButton (visible in toolbar)
  → ChatPanel (modal or slide-out)
    → User types message
    → POST /api/ai/interpret
    → Show interpretation + proposed actions
    → User confirms → feed actions into useStaging hook
    → Staging toolbar appears with cascade preview
    → Existing publish workflow takes over
```

**Key principle:** The chat panel produces staging actions. Everything after that is the existing Phase 2 infrastructure — cascade engine, staging toolbar, settlement impact, publish review, history logging.

---

## UI Mockup (Conceptual)

### Desktop
```
┌─────────────────────────────────────────────────────┐
│ [Job Selector]          [List] [Calendar] [Gantt] 🕐 💬 │
│                                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Schedule content (list/calendar/gantt)           │ │
│ │                                                   │ │
│ │                                                   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌── Chat Panel (slide-out from right) ──────────┐  │
│  │  📝 Here's what I understood:                  │  │
│  │                                                 │  │
│  │  Move Start: Drywall Install                   │  │
│  │  New start: May 6 (currently May 1)            │  │
│  │                                                 │  │
│  │  [Stage Changes]  [Cancel]  [Try Again]        │  │
│  │                                                 │  │
│  │  ┌─────────────────────────────────┐           │  │
│  │  │ Type a schedule change...    [→]│           │  │
│  │  └─────────────────────────────────┘           │  │
│  └────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### Mobile
- 💬 button in toolbar row
- Chat opens as a **full-screen overlay** with a close/back button
- Input at bottom, interpretation above
- Schedule not visible while chat is open (not enough screen space)

**Note:** On desktop, the schedule remains scrollable/interactive while the chat panel is open. Users can reference the schedule while composing requests.

---

## Request Types to Support

| Category | Examples |
|---|---|
| **Move forward/back** | "Push drywall back 3 days", "Move framing forward a week" |
| **Move to date** | "Move settlement to June 15", "Start plumbing on May 1" |
| **Extend/shorten** | "Extend framing by 5 days", "Shorten drywall to 3 days" |
| **Relative moves** | "Push to next Monday", "Delay 2 weeks" |
| **Dependency-aware** | "Push everything after framing back 3 days" |
| **Multi-action** | "Extend framing by 3 days and push drywall to May 10" |
| **Contextual** | "Push it back 2 days" (with activity selected) |
| **Status changes** | "Mark install windows as complete", "Approve all late activities" |
| **Bulk status** | "Complete everything before framing", "Approve all activities due before May" |
| **Queries** | "When does drywall start?", "How long is framing?", "What's late?" (answer without staging) |

---

## Out of Scope (v1)

- **Creating/deleting activities** — chat only moves/updates existing activities
- **Cross-job operations** — one job at a time
- **Voice recording input** — no audio sent to AI; however, users can use their device's native speech-to-text (dictation) to input text, which works automatically with the text input field
- **Undo via chat** — user can Discard All from staging toolbar

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI misinterprets the request | Mandatory confirmation step — user always reviews before staging |
| AI hallucinates activity names | Validate all jsa_rids against actual schedule before returning |
| Slow response time | Use fast model (GPT-4o-mini), keep context lean |
| Cost creep from heavy usage | Track per-request cost in logs; start with cheapest viable model |
| Ambiguous requests lead to frustration | Good disambiguation UX — present options, don't guess |

---

## Success Criteria

1. User can describe a schedule change in plain English and see it staged in <3 seconds
2. AI correctly interprets >90% of straightforward requests (move X by N days) on first attempt
3. Ambiguous requests always prompt for clarification rather than guessing wrong
4. Zero changes applied without user confirmation
5. Cost per interaction stays under $0.05

---

## Resolved Questions

1. **Panel style:** Slide-out from the right on desktop (schedule stays visible and scrollable). Full-screen overlay on mobile.
2. **Quick examples:** Yes — show placeholder examples in empty chat to help less technical users.
3. **API key management:** Reuse existing OpenAI key from server env vars.
4. **Query responses:** Yes — chat answers questions about the schedule (dates, durations, what's late) in addition to handling changes.
5. **Usage logging:** Log all AI interactions to a `chat_interactions` table for analysis.
6. **Status changes:** In scope — users can set Completed/Approved via chat, including bulk operations ("Approve all late activities").
7. **Voice input:** No audio recording, but device-native speech-to-text (dictation) works automatically with the text input.

### Chat Interaction Log Table

```sql
CREATE TABLE chat_interactions (
  interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  job_schedule_rid UUID NOT NULL,
  user_message TEXT NOT NULL,
  ai_response JSONB NOT NULL,
  model_used TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_user ON chat_interactions(user_id);
CREATE INDEX idx_chat_schedule ON chat_interactions(job_schedule_rid);
CREATE INDEX idx_chat_timestamp ON chat_interactions(created_at);
```

---

## Sprint Plan

### Sprint 1: Foundation — API + Basic Chat UI
**Goal:** End-to-end flow working for simple single-activity schedule moves.

| Task | Details |
|---|---|
| `chat_interactions` table | Migration SQL, Rob runs in Supabase |
| `POST /api/ai/interpret` | API route: loads schedule context, calls GPT-4o with system prompt, validates response, logs to `chat_interactions` |
| System prompt v1 | Role, available actions (Move Start, Change Duration), activity list injection, JSON output schema, workday awareness |
| `ChatPanel` component | Slide-out panel (desktop) / full-screen overlay (mobile), text input, send button, loading state |
| 💬 button | Added to toolbar row next to History button |
| Confirmation UI | Show AI interpretation + proposed actions, [Stage Changes] / [Cancel] / [Try Again] buttons |
| Wire to staging | Confirmed actions feed into existing `useStaging` hook → cascade engine → staging toolbar |
| Placeholder examples | Show example prompts in empty chat state |

**Deliverable:** User types "Push drywall back 3 days" → sees interpretation → confirms → changes staged with cascade. Basic error handling for unrecognizable requests.

---

### Sprint 2: Status Changes + Queries
**Goal:** Chat handles status updates and answers questions about the schedule.

| Task | Details |
|---|---|
| Status actions | `set_status` action type — single activity ("Mark install windows as complete") |
| Bulk status | "Approve all late activities", "Complete everything before framing" — AI resolves to multiple `set_status` actions |
| Query responses | "When does drywall start?", "What's late?", "How long is framing?" — AI returns `type: "answer"` with no actions |
| Status validation | Enforce transition rules (Released → Completed/Approved, Completed → Approved only, Approved = locked) |
| Wire status to API | Confirmed status actions call existing `/api/activities/status` endpoint |

**Deliverable:** Full action vocabulary — moves, duration changes, status updates, and informational queries all working through the chat.

---

### Sprint 3: Smart Features
**Goal:** Context awareness, ambiguity handling, conversation memory.

| Task | Details |
|---|---|
| Selected activity context | Pass `selected_jsa_rid` to API — "push it back 3 days" resolves to the selected activity |
| Ambiguity UI | When AI returns `clarification_needed`, show options as clickable buttons |
| Multi-action requests | "Extend framing by 3 days and push drywall to May 10" → multiple actions in one confirmation |
| Conversation history | Keep last N messages in chat session, pass to API for context ("actually make that 5 days") |
| Relative dates | "Push to next Monday", "delay 2 weeks" — workday-aware date resolution |
| Dependency-aware moves | "Push everything after framing back 5 days" |

**Deliverable:** Polished, context-aware chat that handles edge cases gracefully.

---

### Sprint Summary

| Sprint | Scope | Priority |
|---|---|---|
| **Sprint 1** | API + Chat UI + basic moves + confirmation flow | P0 |
| **Sprint 2** | Status changes + bulk status + queries | P0 |
| **Sprint 3** | Context, ambiguity, multi-action, conversation history | P1-P2 |

Each sprint produces a working, testable build on Vercel.
