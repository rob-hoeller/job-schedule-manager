# Job Schedule Manager — Phase 2 PRD
## Schedule Manipulation & User Management

**Version:** 3.0  
**Date:** February 20, 2026  
**Author:** Sherlock (OpenClaw Agent)  
**Status:** Draft v3 — Awaiting Final Review

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-20 | Initial draft |
| 2.0 | 2026-02-20 | Added staging/publish workflow, robust change history model, switched to Supabase Auth, removed RLS migration concerns |
| 3.0 | 2026-02-20 | Defined two move types (Move Start, Change Duration), locked status enum (Completed, Approved), required publish notes, independent staging sandboxes, no status cascade, calendar scoped to 2026 |

---

## Executive Summary

Phase 2 transforms the Job Schedule Manager from a read-only visualization tool into an interactive schedule management system. Users can perform two types of schedule moves — **Move Start** (shift start date, end date follows preserving duration) and **Change Duration** (keep start date, adjust end date) — then preview cascading impacts across the full dependency chain before publishing. All changes are tracked with complete audit history, grouped by publish event with required notes. Authentication is handled by Supabase Auth.

**Core Features:**
- **Two move types:** Move Start and Change Duration — clear, predictable schedule edits
- **Stage & Publish workflow** — edit in a staging layer, preview dependency cascade, publish when ready
- **Dependency chain propagation** — date changes ripple through all downstream activities automatically
- **Full change history** — every field change recorded with old/new values, grouped by publish event with required notes
- **Status updates** — mark activities as Completed or Approved (no cascade, no staging needed)
- **Supabase Auth** — leverages existing user management, invite-only access
- **Multi-view editing** — interactive from List, Calendar, and Gantt views

---

## Goals & Success Criteria

### Primary Goals
1. **Stage & Preview:** Users make date/duration edits and see cascading impacts before committing
2. **Publish with Confidence:** Batch publish ensures all date changes go live atomically
3. **Full Audit Trail:** Complete history of every change — who, what, when, before, after, why
4. **Secure Access:** Supabase Auth with trusted developer access
5. **Maintain Data Integrity:** Validation + dependency propagation prevent invalid schedules

### Success Metrics
- Zero data loss incidents
- 100% of published changes logged with user attribution, batch grouping, and required notes
- Dependency cascade preview renders in <2 seconds for a full schedule
- Mobile-friendly edit interface (touch targets ≥44px)

---

## User Stories

### As a Schedule Manager, I want to...
1. **Move an activity's start date** and see the end date shift automatically (preserving duration), plus all downstream cascading effects
2. **Change an activity's duration** and see the end date adjust while keeping the start date fixed, plus all downstream cascading effects
3. **Make multiple edits** in a staging session before committing anything to the live schedule
4. **Review all staged changes** in a summary view before publishing
5. **Discard staged changes** if the projected schedule doesn't look right
6. **Publish all staged changes at once** with a required note explaining the reason
7. **Mark an activity as Completed or Approved** as a quick status update (immediate, no staging)
8. **Edit from any view** so I can work in my preferred visualization mode

### As a Project Executive, I want to...
1. **Review change history** for any activity to understand how its dates evolved over time
2. **Read publish notes** to understand why schedule changes were made
3. **See the full scope of a publish event** — every activity affected in that batch

---

## Functional Requirements

### FR-1: Move Types
**Priority:** P0 (Critical)

Two distinct types of schedule moves, each with clear and predictable behavior:

#### Move Start
- User selects a **new start date** for the activity
- **End date auto-adjusts**: new end date = new start date + current duration (using workday calendar)
- **Duration is preserved** — it does not change
- Cascades through dependency chain (downstream activities recalculated)

**Example:**
```
Before:  Start: Mar 15  |  Duration: 3 days  |  End: Mar 17
Move Start → Mar 18
After:   Start: Mar 18  |  Duration: 3 days  |  End: Mar 20
```

#### Change Duration
- User selects a **new duration** (workdays)
- **Start date is preserved** — it does not change
- **End date auto-adjusts**: new end date = current start date + new duration (using workday calendar)
- Cascades through dependency chain (downstream activities recalculated)

**Example:**
```
Before:  Start: Mar 15  |  Duration: 3 days  |  End: Mar 17
Change Duration → 5 days
After:   Start: Mar 15  |  Duration: 5 days  |  End: Mar 21
```

**Key Constraint:** Users never edit start date, end date, and duration independently. The two move types enforce internally consistent relationships at all times.

### FR-2: Status Updates
**Priority:** P0 (Critical)

- Users can set activity status to **Completed** or **Approved**
- These are the **only two statuses** a user can assign
- Status changes are **immediate** — they do not go through staging
- Status changes **do not cascade** through the dependency chain
- Status changes **are logged** in the change history (as part of a single-change publish event with a required note)

### FR-3: Stage & Publish Workflow
**Priority:** P0 (Critical)

**Staging Phase:**
- User clicks/taps an activity and performs a **Move Start** or **Change Duration**
- Changes are saved to a **staging layer** (not the live `job_schedule_activities` table)
- The **dependency engine** recalculates all downstream activities using the schedule dependency model (FS/SS with lag days, workday calendar)
- Cascaded changes are also written to the staging layer
- All three views reflect staged changes with **visual differentiation** (e.g., dashed borders, amber highlight, "staged" badge)
- User can continue editing additional activities — each edit re-cascades
- User can **discard all staged changes** to revert to the live schedule
- User can **discard individual staged edits** (recascade after removal)
- **Each user has an independent staging sandbox** — User A's staged changes are invisible to User B

**Publishing Phase:**
- User clicks "Review & Publish" to see a summary of all staged changes
- Summary shows: activity name, move type, old value → new value, whether the change was direct or cascaded
- User **must provide a publish note** explaining the reason for the changes
- User clicks "Publish" to commit all staged changes atomically
- On publish:
  1. All staged records write to `job_schedule_activities`
  2. Full change history is logged (one `publish_event`, many `change_records`)
  3. Staging layer is cleared
- On failure: transaction rolls back, staging layer preserved, error displayed

### FR-4: Dependency Chain Propagation
**Priority:** P0 (Critical)

When a user stages a Move Start or Change Duration, the system recalculates affected activities:

**Propagation Rules** (from existing schedule dependency model):
- **FS (Finish-Start):** Successor start = predecessor end + lag_days (workdays)
- **SS (Start-Start):** Successor start = predecessor start + lag_days (workdays)
- Positive lag pushes successor later; negative lag pulls earlier
- Workdays only — skip non-workdays from `calendar_days` table
- Multiple predecessors: latest calculated date wins (most constraining)
- End date = start date + duration (workdays) — duration is preserved for cascaded activities

**Cascade Behavior:**
- Only **date changes** cascade — status changes do **not** cascade
- Propagation follows the full dependency chain (not just direct successors)
- Activities with multiple predecessors recalculate from all predecessors
- Cascaded changes are visually distinct from direct user edits
- If a cascaded change conflicts with a previous staged edit, flag it for user review

### FR-5: Multi-View Editing
**Priority:** P0 (Critical)

Edit functionality available from all three views:

**List View:**
- Click row to open edit panel
- Staged rows highlighted with amber/yellow indicator
- Cascaded rows highlighted with a lighter/different indicator

**Calendar View:**
- Click activity card to open edit panel
- Staged activities show visual differentiation
- Drag-and-drop to change dates *(Phase 2.5 enhancement)*

**Gantt View:**
- Click activity bar to open edit panel
- Staged bars rendered with dashed borders or distinct color overlay
- Dependency arrows update in real-time to reflect staged positions
- Drag handles to adjust dates *(Phase 2.5 enhancement)*

**Staging Toolbar (persistent while staging active):**
- Shows count of staged changes (direct + cascaded)
- "Review & Publish" button
- "Discard All" button
- Visible across all views, persists during view switching

### FR-6: Change History
**Priority:** P0 (Critical)

**Data Model:**
Changes are grouped into **publish events**. Each publish event contains one or more **change records**, each capturing a single field change on a single activity.

**Publish Event captures:**
- Who published (user ID + display name)
- When (timestamp)
- **Publish note** (required — explains the reason for the changes)
- Move type(s) involved (Move Start, Change Duration, Status Update)
- Total number of changes in the batch (direct + cascaded)

**Change Record captures:**
- Which activity (`jsa_rid`)
- Which job schedule (`job_schedule_rid`)
- Which field was changed (`start_date`, `end_date`, `duration`, `status`)
- Old value
- New value
- Whether the change was a **direct edit** or **cascaded** from a dependency
- If cascaded, which direct edit triggered it (`source_jsa_rid`)

**History Views:**
- **Activity History:** Click "History" on any activity to see all changes over time, newest first
- **Schedule History:** View all publish events for a schedule, expandable to see individual changes
- **Publish Event Detail:** Drill into a single publish event to see every change in the batch

### FR-7: User Authentication (Supabase Auth)
**Priority:** P0 (Critical)

**Login Page:**
- Email + password form
- Powered by Supabase Auth (uses existing `auth.users` table)
- "Remember me" checkbox
- Error handling (invalid credentials, network errors)
- Password reset flow via Supabase email

**Session Management:**
- Supabase handles JWT issuance and refresh
- `@supabase/ssr` for Next.js server-side session handling
- Auto-redirect to login on session expiration
- Logout functionality in nav bar
- User display name shown in nav bar

**User Management:**
- Users created via Supabase Dashboard or `supabase.auth.admin.createUser()`
- No self-registration (invite-only)
- Initial user: Rob (email to be provided at implementation time)
- Profile stored in `auth.users` (Supabase managed) with `public.user_profiles` for display names

### FR-8: Access Control
**Priority:** P1 (High)

**Phase 2:**
- All authenticated users have full read/write access
- Service key used for database operations
- Trusted user pool: Rob + 1-2 developers — no RLS needed
- No role differentiation

**Future Phases (if user base grows):**
- Role-based access control (viewer, editor, admin)
- Schedule-specific permissions

---

## Technical Requirements

### TR-1: Database Schema

#### New Table: `user_profiles`
Links Supabase Auth users to app-specific display info.
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### New Table: `staged_changes`
Holds in-progress edits before publishing. Scoped per-user for independent staging sandboxes.
```sql
CREATE TABLE staged_changes (
  staged_change_rid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  job_schedule_rid UUID NOT NULL,
  jsa_rid UUID NOT NULL,
  move_type TEXT NOT NULL,           -- 'move_start', 'change_duration'
  field_name TEXT NOT NULL,          -- 'start_date', 'end_date', 'duration'
  original_value TEXT,               -- value before any staging
  staged_value TEXT NOT NULL,        -- proposed new value
  is_direct_edit BOOLEAN NOT NULL DEFAULT TRUE,  -- false = cascaded from dependency
  source_jsa_rid UUID,              -- if cascaded, which direct edit triggered it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staged_user ON staged_changes(user_id);
CREATE INDEX idx_staged_schedule ON staged_changes(job_schedule_rid);
CREATE INDEX idx_staged_jsa ON staged_changes(jsa_rid);

-- Each user can only have one staged value per field per activity
CREATE UNIQUE INDEX idx_staged_unique 
  ON staged_changes(user_id, jsa_rid, field_name);
```

#### New Table: `publish_events`
Groups a batch of published changes.
```sql
CREATE TABLE publish_events (
  publish_event_rid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  job_schedule_rid UUID NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  publish_note TEXT NOT NULL,        -- REQUIRED: explains reason for changes
  move_types TEXT[] NOT NULL,        -- e.g. ['move_start'], ['change_duration'], ['move_start','change_duration'], ['status_update']
  change_count INTEGER NOT NULL,     -- total changes in this batch
  direct_edit_count INTEGER NOT NULL,
  cascaded_count INTEGER NOT NULL
);

CREATE INDEX idx_publish_user ON publish_events(user_id);
CREATE INDEX idx_publish_schedule ON publish_events(job_schedule_rid);
CREATE INDEX idx_publish_timestamp ON publish_events(published_at);
```

#### New Table: `change_records`
Individual field-level changes within a publish event.
```sql
CREATE TABLE change_records (
  change_record_rid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_event_rid UUID NOT NULL REFERENCES publish_events(publish_event_rid),
  jsa_rid UUID NOT NULL,
  job_schedule_rid UUID NOT NULL,
  field_name TEXT NOT NULL,          -- 'start_date', 'end_date', 'duration', 'status'
  old_value TEXT,
  new_value TEXT NOT NULL,
  is_direct_edit BOOLEAN NOT NULL DEFAULT TRUE,
  source_jsa_rid UUID,              -- if cascaded, which activity's edit caused this
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_change_publish ON change_records(publish_event_rid);
CREATE INDEX idx_change_jsa ON change_records(jsa_rid);
CREATE INDEX idx_change_schedule ON change_records(job_schedule_rid);
CREATE INDEX idx_change_timestamp ON change_records(changed_at);
```

#### Modified Table: `job_schedule_activities`
Add audit fields:
```sql
ALTER TABLE job_schedule_activities
ADD COLUMN last_modified_by UUID REFERENCES auth.users(id),
ADD COLUMN last_modified_at TIMESTAMPTZ;
```

### TR-2: API Routes

**Authentication (Supabase-powered):**
- `POST /api/auth/login` — Sign in via `supabase.auth.signInWithPassword()`
- `POST /api/auth/logout` — Sign out via `supabase.auth.signOut()`
- `GET /api/auth/session` — Get current session/user
- Middleware: `@supabase/ssr` for server-side session validation

**Staging Operations:**
- `POST /api/staging/move-start` — Stage a Move Start edit (triggers cascade)
  - Body: `{ jsa_rid, job_schedule_rid, new_start_date }`
- `POST /api/staging/change-duration` — Stage a Change Duration edit (triggers cascade)
  - Body: `{ jsa_rid, job_schedule_rid, new_duration }`
- `GET /api/staging?job_schedule_rid=X` — Get all current staged changes for user + schedule
- `DELETE /api/staging/{staged_change_rid}` — Remove a single staged edit (recascade)
- `DELETE /api/staging?job_schedule_rid=X` — Discard all staged changes for user + schedule

**Publishing:**
- `POST /api/staging/publish` — Validate, write to live tables, log to history, clear staging
  - Body: `{ job_schedule_rid, publish_note }` (note is required)

**Status Updates (immediate, no staging):**
- `POST /api/activities/{jsa_rid}/status` — Update status + log to history
  - Body: `{ status, publish_note }` (note is required)

**Change History:**
- `GET /api/history/activity/{jsa_rid}` — Change records for a specific activity
- `GET /api/history/schedule/{job_schedule_rid}` — Publish events for a schedule
- `GET /api/history/event/{publish_event_rid}` — All change records in a publish event

### TR-3: Dependency Cascade Engine

**Server-Side Implementation:**
- Reusable cascade function that takes a set of date/duration changes and returns all affected activities with new calculated dates
- Must load: `job_schedule_activity_dependencies`, `calendar_days`, and current (or staged) activity dates
- Algorithm:
  1. Apply direct edit (Move Start or Change Duration) to target activity
  2. Calculate resulting start_date, end_date, and duration for the edited activity
  3. Topological sort of dependency graph from edited activity forward
  4. Walk forward through successors, applying FS/SS rules with lag
  5. For each successor: recalculate start_date from predecessors, preserve existing duration, calculate new end_date
  6. Return full diff: `{ jsa_rid, field, old_value, new_value, is_direct, source_jsa_rid }`

**Critical Rule:** Duration is **never changed** by cascade propagation. Only start_date and end_date shift. Duration only changes via direct Change Duration edits.

**Performance Consideration:**
- Cache `calendar_days` in memory (small table, covers 2026 — sufficient for POC)
- Cascade calculation should complete in <1 second for a full schedule (~200 activities)

### TR-4: Authentication Implementation (Supabase Auth)

**Technology:** `@supabase/supabase-js` + `@supabase/ssr`

**Client-Side:**
- `createBrowserClient()` for client components
- Auth state managed via Supabase's built-in listener (`onAuthStateChange`)
- React Context provider wraps app with current user

**Server-Side:**
- `createServerClient()` for server components and API routes
- Middleware in `middleware.ts` to protect routes
- Redirect unauthenticated users to `/login`

**Login Flow:**
1. User enters email + password on `/login`
2. `supabase.auth.signInWithPassword({ email, password })`
3. Supabase returns JWT session
4. `@supabase/ssr` sets HTTP-only cookies
5. Subsequent requests include session automatically
6. Server components read session via `createServerClient()`

**User Provisioning:**
- Initial user (Rob) created via Supabase Dashboard at implementation time
- Additional developers added via Dashboard as needed
- On first login, auto-create `user_profiles` record if missing

### TR-5: Environment Variables

```bash
# Database (existing)
NEXT_PUBLIC_SUPABASE_URL=...          # Public Supabase URL (safe for client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # Public anon key (safe for client)
SUPABASE_SERVICE_KEY=...               # Server-side only, full access
```

No additional auth secrets needed — Supabase handles JWT signing internally.

### TR-6: Frontend State Management

**Current:** Server components + URL state (searchParams)

**Phase 2 Additions:**
- **Auth Context:** Supabase session provider wrapping the app
- **Staging State:** React Context or Zustand store for staged changes
  - Persists across view switches (List ↔ Calendar ↔ Gantt)
  - Cleared on publish or discard
  - Backed by `staged_changes` table (survives page refresh)
  - Stores: `Map<jsa_rid, { move_type, staged_start, staged_end, staged_duration, isDirect }>`
- **Staged Views:** Each view component reads staging context and applies visual overlays
- **Toast Notifications:** react-hot-toast for save/publish/error feedback

### TR-7: Validation & Business Rules

**Client-Side Validation:**
- Move Start: new start date must be a valid workday (or auto-adjust to next workday)
- Change Duration: new duration must be > 0
- Real-time feedback in edit panel

**Server-Side Validation (on staging):**
- Verify activity exists and belongs to schedule
- Verify user is authenticated
- Recalculate cascade and store results

**Server-Side Validation (on publish):**
- Re-validate all staged changes
- Re-run cascade to ensure consistency (detect stale staging)
- Verify no conflicting concurrent publishes (check `last_modified_at`)
- Verify publish note is non-empty
- Atomic transaction: all-or-nothing publish

---

## UI/UX Design

### Edit Panel

**Desktop (Side Panel / Modal):**
- Opens as a right-side panel (480px) or centered modal
- Shows activity name, current job schedule, current dates/duration/status

**Two Action Tabs:**

**Tab 1: Move Start**
```
┌─────────────────────────────────────┐
│  Move Start: Foundation Pour        │
│                                      │
│  Current Start:  Mar 15, 2026       │
│  Current End:    Mar 17, 2026       │
│  Duration:       3 days (preserved) │
│                                      │
│  New Start Date: [2026-03-18] 📅    │
│  New End Date:   Mar 20, 2026 (auto)│
│                                      │
│  [Cancel]           [Stage Move →]  │
└─────────────────────────────────────┘
```

**Tab 2: Change Duration**
```
┌─────────────────────────────────────┐
│  Change Duration: Foundation Pour   │
│                                      │
│  Start Date:     Mar 15, 2026 (fixed)│
│  Current Duration: 3 days           │
│  Current End:      Mar 17, 2026     │
│                                      │
│  New Duration:   [-]  5  [+] days   │
│  New End Date:   Mar 21, 2026 (auto)│
│                                      │
│  [Cancel]           [Stage Move →]  │
└─────────────────────────────────────┘
```

**Status Section (always visible, below tabs):**
```
│  ─────────────────────────────────  │
│  Status: [Not Started ▼]            │
│          Options: Completed | Approved│
│  [Update Status] (immediate)        │
```
- Status dropdown only shows **Completed** and **Approved** as selectable options
- Current status displayed but non-selectable (e.g., "Not Started" is read-only)
- "Update Status" triggers immediate save + history log (with required note prompt)

**History Tab:**
- Shows past changes for this activity (newest first)
- Each entry shows publish note, user, timestamp, and field changes

**Mobile (Bottom Sheet):**
- Slide up from bottom, full width
- Swipe between Move Start / Change Duration tabs
- Same field layout, larger touch targets (48px min)
- "Stage Move" prominently placed

### Staging Visual Language

Consistent visual indicators across all views:

| Indicator | Meaning |
|-----------|---------|
| 🟡 Amber/yellow highlight | Direct edit (user changed this) |
| 🔶 Light orange highlight | Cascaded change (dependency propagation) |
| Dashed border | Activity has staged changes |
| Solid border | Live/committed data |
| Badge: "Staged" | Activity has staged changes |

### Staging Toolbar

Persistent bar at top of content area (below nav, above filters):
```
┌──────────────────────────────────────────────────────────┐
│  ⚡ 12 staged changes (4 direct, 8 cascaded)            │
│                                                          │
│  [Discard All]                    [Review & Publish →]   │
└──────────────────────────────────────────────────────────┘
```
- Only visible when staging is active
- Persists across view switches
- "Review & Publish" opens the publish review modal

### Publish Review Modal

```
┌─────────────────────────────────────────────────────────┐
│  📋 Review Staged Changes                               │
│                                                          │
│  Schedule: Coastal Winds - Lot 42                        │
│  Changes: 12 total (4 direct edits, 8 cascaded)         │
│                                                          │
│  ┌─ Direct Edits ─────────────────────────────────────┐ │
│  │ Foundation Pour — Move Start                        │ │
│  │   Start Date: Mar 15 → Mar 18                      │ │
│  │   End Date:   Mar 17 → Mar 20 (auto)              │ │
│  │                                                     │ │
│  │ Framing — Change Duration                           │ │
│  │   Duration:   5 → 7 days                            │ │
│  │   End Date:   Mar 28 → Apr 1 (auto)               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ Cascaded Changes ─────────────────────────────────┐ │
│  │ Rough Plumbing         Start: Mar 18 → Mar 21     │ │
│  │ Rough Electric         Start: Mar 18 → Mar 21     │ │
│  │ Insulation             Start: Mar 25 → Mar 28     │ │
│  │ Drywall                Start: Mar 28 → Mar 31     │ │
│  │ ... +4 more                                        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  Publish Note (required):                                │
│  [Weather delay - 3 day push on foundation_________]     │
│                                                          │
│  [Cancel]                            [Publish Changes]   │
└─────────────────────────────────────────────────────────┘
```

**Publish button is disabled until the note field is non-empty.**

### Status Update Note Prompt

When a user clicks "Update Status", a small modal prompts for the required note:
```
┌─────────────────────────────────────┐
│  Update Status: Foundation Pour     │
│                                      │
│  New Status: Completed ✓            │
│                                      │
│  Note (required):                    │
│  [Foundation pour completed per____] │
│  [_inspection on 3/20_____________] │
│                                      │
│  [Cancel]            [Confirm]      │
└─────────────────────────────────────┘
```

### Change History Panel

Accessible from activity edit panel ("History" tab) or from a schedule-level history page:

```
┌─────────────────────────────────────────────────────────┐
│  📜 History: Foundation Pour                            │
│                                                          │
│  Feb 20, 2026 3:45 PM — Rob Hoeller                     │
│  "Weather delay - 3 day push on foundation"              │
│  Move Start | Published 12 changes (4 direct, 8 cascaded)│
│    Start Date: Mar 15 → Mar 18  [direct]                │
│    End Date:   Mar 17 → Mar 20  [cascaded]              │
│                                                          │
│  Feb 18, 2026 10:15 AM — Rob Hoeller                    │
│  "Foundation pour completed per inspection on 3/20"      │
│  Status Update                                           │
│    Status: Not Started → Completed  [direct]            │
│                                                          │
│  Feb 15, 2026 9:00 AM — Rob Hoeller                     │
│  "Initial schedule setup"                                │
│  Move Start | Published 1 change                         │
│    Start Date: (none) → Mar 15  [direct]                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Visual Feedback

**Activity Hover States:**
- **List View:** Row background lightens, cursor pointer
- **Calendar View:** Card shadow intensifies, slight scale (1.02x)
- **Gantt View:** Bar border thickens, brightness increases

**Staging States:**
- All views render staged data as the "current" visualization but with staging visual indicators
- Switching views preserves staging context
- Gantt dependency arrows update to reflect staged positions

### Login Page

Clean, minimal design consistent with app theming:
```
┌─────────────────────────────────┐
│                                  │
│     🏗️ Job Schedule Manager     │
│                                  │
│     Email                        │
│     [________________________]   │
│                                  │
│     Password                     │
│     [________________________]   │
│                                  │
│     ☐ Remember me                │
│                                  │
│     [      Sign In      ]        │
│                                  │
│     Forgot password?             │
│                                  │
└─────────────────────────────────┘
```

---

## Security Considerations

### Phase 2 Security
1. **HTTPS Only:** All traffic encrypted (Vercel default)
2. **Supabase Auth:** Industry-standard authentication, bcrypt password hashing, JWT with refresh tokens
3. **HTTP-Only Cookies:** Session tokens stored securely via `@supabase/ssr`
4. **SQL Injection Prevention:** Supabase client parameterizes all queries
5. **XSS Prevention:** Next.js auto-escapes JSX output
6. **CSRF Protection:** Supabase Auth cookie-based flow includes CSRF protection
7. **Trusted User Pool:** Rob + 1-2 developers, all with full access via service key

---

## Implementation Plan

### Phase 2.0: Foundation (Week 1-2)
**Sprint 1: Authentication & Database**
- [ ] Install `@supabase/ssr` and configure for Next.js App Router
- [ ] Create `user_profiles` table
- [ ] Create `staged_changes` table
- [ ] Create `publish_events` table
- [ ] Create `change_records` table
- [ ] Add audit columns to `job_schedule_activities`
- [ ] Build login page UI (light + dark mode)
- [ ] Implement Supabase Auth sign-in/sign-out
- [ ] Add auth middleware (protect all routes except `/login`)
- [ ] User context provider + nav bar user display
- [ ] Create Rob's user account via Supabase Dashboard

### Phase 2.1: Cascade Engine & Staging API (Week 2-3)
**Sprint 2: Server-Side Logic**
- [ ] Build dependency cascade engine (topological sort + FS/SS propagation)
- [ ] Integrate `calendar_days` for workday calculations (2026 scope sufficient for POC)
- [ ] `POST /api/staging/move-start` — stage Move Start + cascade
- [ ] `POST /api/staging/change-duration` — stage Change Duration + cascade
- [ ] `GET /api/staging` — retrieve current staged changes
- [ ] `DELETE /api/staging` — discard staged changes
- [ ] `POST /api/staging/publish` — atomic publish with required note + change logging
- [ ] `POST /api/activities/{jsa_rid}/status` — immediate status update with required note
- [ ] Unit tests for cascade engine (critical path — must be correct)

### Phase 2.2: Edit UI & Staging (Week 3-4)
**Sprint 3: Frontend Staging**
- [ ] Build edit panel component with Move Start / Change Duration tabs
- [ ] Date picker for Move Start, duration +/- for Change Duration
- [ ] Status section with Completed/Approved dropdown
- [ ] Status update note prompt modal
- [ ] Client-side validation
- [ ] Staging context provider (persists across views, backed by DB)
- [ ] Staging visual indicators (amber/orange highlights, dashed borders)
- [ ] Staging toolbar (change count, Review & Publish, Discard All)
- [ ] Integrate staging overlays into List View
- [ ] Integrate staging overlays into Calendar View
- [ ] Integrate staging overlays into Gantt View
- [ ] Toast notifications

### Phase 2.3: Publish & History (Week 4-5)
**Sprint 4: Publishing & Audit**
- [ ] Publish review modal (summary of all staged changes with move types)
- [ ] Required publish note field (Publish button disabled until filled)
- [ ] Publish execution with loading/success/error states
- [ ] Activity history panel (change records timeline with notes)
- [ ] Schedule history page (publish events list)
- [ ] Publish event detail view (drill into batch)

### Phase 2.4: Polish & Testing (Week 5-6)
**Sprint 5: QA & Deployment**
- [ ] End-to-end testing: Move Start → stage → cascade → publish → verify
- [ ] End-to-end testing: Change Duration → stage → cascade → publish → verify
- [ ] End-to-end testing: Status update → immediate save → verify history
- [ ] Multi-user staging isolation (User A's sandbox independent of User B)
- [ ] Mobile responsive testing (iOS Safari, Android Chrome)
- [ ] Error scenario testing (network failures, concurrent publishes)
- [ ] Performance testing (cascade on full schedule)
- [ ] Dark mode + light mode consistency
- [ ] Deploy to production

### Phase 2.5: Enhancements (Future)
- [ ] Drag-and-drop Move Start (Gantt + Calendar)
- [ ] Drag bar edges for Change Duration (Gantt)
- [ ] Bulk status updates
- [ ] Undo last publish (revert from change history)
- [ ] Real-time collaboration (WebSockets — see staging from other users)
- [ ] Change log CSV export
- [ ] Email notifications on publish

---

## Dependencies & Risks

### Technical Dependencies
- **@supabase/ssr:** Server-side Supabase Auth for Next.js
- **@supabase/supabase-js:** Client-side Supabase (already in project)
- **date-fns:** Date manipulation (already in project)
- **react-hot-toast:** Toast notifications
- **Zustand** (optional): Lightweight state management for staging context

### Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Cascade engine produces incorrect dates | High | Medium | Extensive unit tests; compare against known schedule calculations |
| Concurrent publishes corrupt data | High | Low | Optimistic locking via `last_modified_at`; 2-3 user pool minimizes risk |
| Staging state lost on page refresh | Medium | Low | Staging persisted in `staged_changes` table, not just client state |
| Poor mobile UX for staging workflow | Medium | Medium | Prioritize desktop for Phase 2; refine mobile in 2.5 |
| Performance degradation with large change history | Low | Low | Paginate queries, index on timestamp and jsa_rid |

---

## Appendix A: Database ERD

```
┌──────────────┐      ┌────────────────────────┐
│ auth.users   │      │ user_profiles           │
│ (Supabase)   │      │                         │
│ id PK ───────┼──────┤ id PK/FK               │
│ email        │      │ display_name            │
│ ...          │      └────────────────────────┘
└──────┬───────┘
       │
       ├──────────────────┬──────────────────────┐
       │                  │                      │
       ▼                  ▼                      ▼
┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ staged_changes   │  │ publish_events  │  │ job_schedule_    │
│                  │  │                 │  │ activities       │
│ staged_change_rid│  │ publish_event_  │  │                  │
│ user_id FK       │  │ rid PK         │  │ jsa_rid PK       │
│ jsa_rid          │  │ user_id FK     │  │ start_date       │
│ move_type        │  │ job_schedule_  │  │ end_date         │
│ field_name       │  │ rid            │  │ duration         │
│ original_value   │  │ published_at   │  │ status           │
│ staged_value     │  │ publish_note   │  │ last_modified_by │
│ is_direct_edit   │  │ move_types[]   │  │ last_modified_at │
│ source_jsa_rid   │  │ change_count   │  └──────────────────┘
└──────────────────┘  └───────┬─────────┘           │
                              │                     │
                              ▼                     │
                    ┌──────────────────┐            │
                    │ change_records   │            │
                    │                  │            │
                    │ change_record_rid│            │
                    │ publish_event_rid│◄───────────┘
                    │ jsa_rid          │
                    │ field_name       │
                    │ old_value        │
                    │ new_value        │
                    │ is_direct_edit   │
                    │ source_jsa_rid   │
                    └──────────────────┘
```

---

## Appendix B: Staging Lifecycle Diagram

```
                    ┌─────────┐
                    │  Live   │
                    │Schedule │
                    └────┬────┘
                         │
                    User clicks activity
                         │
                    ┌────┴────┐
                    │         │
              Move Start   Change Duration
                    │         │
                    ▼         ▼
        ┌───────────────────────────────┐
        │  Apply direct edit to target  │
        │  activity (stage layer only)  │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │     Cascade Engine            │
        │  Walk dependency chain:       │
        │  - Recalculate start dates    │
        │  - Preserve durations         │
        │  - Recalculate end dates      │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │     Staging Layer             │
        │  (direct edits + cascaded     │
        │   changes, per-user sandbox,  │──── User can edit more
        │   visible in all views)       │     activities (loop)
        └───────────────┬───────────────┘
                        │
              ┌─────────┴─────────┐
              │                   │
         "Discard All"    "Review & Publish"
              │                   │
              ▼                   ▼
        ┌──────────┐    ┌─────────────────┐
        │  Revert  │    │ Publish Review  │
        │  to Live │    │ Modal (summary, │
        └──────────┘    │ required note)  │
                        └────────┬────────┘
                                 │
                            "Publish"
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Atomic Transaction    │
                    │  1. Write to live table│
                    │  2. Log publish_event  │
                    │  3. Log change_records │
                    │  4. Clear staging      │
                    └────────────────────────┘


        ═══ Status Updates (separate path) ═══

        Click "Update Status" on any activity
                        │
                        ▼
                ┌───────────────┐
                │ Select status │
                │ (Completed or │
                │  Approved)    │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │ Enter required│
                │ note          │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────────────┐
                │ Immediate write:      │
                │ 1. Update JSA status  │
                │ 2. Log publish_event  │
                │ 3. Log change_record  │
                │ (no staging, no       │
                │  cascade)             │
                └───────────────────────┘
```

---

## Appendix C: Move Type Examples

### Move Start — Full Cascade Example

**Scenario:** Foundation Pour (3-day duration) is delayed from Mar 15 to Mar 18.

```
DIRECT EDIT:
  Foundation Pour
    Move Start: Mar 15 → Mar 18
    Duration: 3 days (preserved)
    End Date: Mar 17 → Mar 20 (auto-calculated)

CASCADED (FS, lag 0):
  Rough Plumbing
    Start: Mar 18 → Mar 21 (predecessor end moved)
    Duration: 2 days (preserved)
    End: Mar 19 → Mar 22

CASCADED (FS, lag 0):
  Rough Electric (SS with Rough Plumbing, lag 1):
    Start: Mar 19 → Mar 22 (predecessor start + 1 workday)
    Duration: 3 days (preserved)
    End: Mar 21 → Mar 24

  ... continues through chain
```

### Change Duration — Full Cascade Example

**Scenario:** Framing extended from 5 days to 7 days.

```
DIRECT EDIT:
  Framing
    Duration: 5 → 7 days
    Start: Mar 21 (preserved)
    End Date: Mar 27 → Mar 31 (auto-calculated)

CASCADED (FS, lag 0):
  Insulation
    Start: Mar 28 → Apr 1 (predecessor end moved)
    Duration: 2 days (preserved)
    End: Mar 31 → Apr 2

  ... continues through chain
```

---

**End of PRD v3.0**

---

*Generated by Sherlock (OpenClaw Agent) using Claude Opus-4*  
*For questions or changes, ping @rhoeller*
