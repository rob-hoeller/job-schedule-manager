# Schedule Manager — Product Requirements Document

**Version:** 1.0 (Proof of Concept)
**Date:** February 19, 2026
**Author:** Data Analyst / Rob Hoeller
**Status:** Draft — Pending Review

---

## 1. Overview

### 1.1 Purpose
Build a proof-of-concept Schedule Manager web application that visualizes construction job schedules for Schell Brothers. The app displays activity timelines, dependencies, and status for any selected job using three distinct views: List, Calendar, and Gantt Chart.

### 1.2 Scope
This is a **read-only visualization tool** for the 10 existing schedules already populated in Supabase. No schedule editing, recalculation, or date cascading is included in this POC.

### 1.3 Data Source
- **Database:** Supabase (PostgreSQL)
- **Tables:** `jobs`, `job_schedule_activities`, `job_schedule_activity_dependencies`, `calendar_days`
- **Join path:** `jobs.schedule_rid` → `job_schedule_activities.schedule_rid` → `job_schedule_activity_dependencies` (via `jsa_rid`)

---

## 2. Users & Access

### 2.1 Target Users
- Rob Hoeller (primary) — desktop and mobile
- Schell Brothers construction managers (future)

### 2.2 Access Model
- Single-user POC, no authentication required
- Locally hosted (localhost) or simple deployment

---

## 3. Functional Requirements

### 3.1 Job Selector

| ID | Requirement |
|---|---|
| JS-1 | Dropdown/selector at top of page listing all jobs |
| JS-2 | Each option displays: **Community Name — Lot #** (e.g., "Miralon — Lot 78") |
| JS-3 | Selecting a job loads its schedule into the active view |
| JS-4 | Display job metadata summary: community, lot, plan name, start date, estimated end date, status |
| JS-5 | Default state: no job selected, prompt user to choose one |

### 3.2 List View

| ID | Requirement |
|---|---|
| LV-1 | Tabular display of all activities for the selected job |
| LV-2 | Columns: **Activity Description**, **Trade Partner**, **Status**, **Start Date**, **End Date**, **Duration (days)** |
| LV-3 | Use `current_start_date` / `current_end_date` / `current_duration` as primary display dates |
| LV-4 | Show `original_start_date` / `original_end_date` if they differ from current (visual indicator for slippage) |
| LV-5 | Sort by `current_start_date` ascending (default) |
| LV-6 | Secondary sort options: by trade partner, by status, by description |
| LV-7 | Status badges with color coding: **Released** (blue), **Approved** (green), **Completed** (gray) |
| LV-8 | Search/filter bar to filter activities by description or trade partner name |
| LV-9 | Row click expands to show: predecessors list, successors list, dependency types, lag days |
| LV-10 | Activity count summary at top (e.g., "195 activities — 12 Completed, 45 Approved, 138 Released") |

### 3.3 Calendar View

| ID | Requirement |
|---|---|
| CV-1 | Monthly calendar grid showing activities on their scheduled dates |
| CV-2 | Activities span across their start-to-end date range |
| CV-3 | Color-coded by status (same scheme as List View) |
| CV-4 | Non-workdays (weekends, holidays) visually distinguished (shaded/hatched background) |
| CV-5 | Holiday descriptions shown on applicable days (from `calendar_days.description`) |
| CV-6 | Month navigation (previous/next) with current month indicator |
| CV-7 | Click on an activity shows detail popup: description, trade partner, dates, duration, dependencies |
| CV-8 | **Desktop:** Full month grid, activities shown as horizontal bars spanning days |
| CV-9 | **Mobile:** Condensed week-at-a-time view or scrollable day list; activities as stacked cards |
| CV-10 | "Today" marker line when viewing current month |

### 3.4 Gantt Chart View

| ID | Requirement |
|---|---|
| GC-1 | Horizontal bar chart with activities on Y-axis, dates on X-axis |
| GC-2 | Each activity rendered as a horizontal bar from `current_start_date` to `current_end_date` |
| GC-3 | Color-coded by status (same scheme) |
| GC-4 | Dependency lines drawn between connected activities (predecessor → successor arrows) |
| GC-5 | FS dependencies: arrow from end of predecessor bar to start of successor bar |
| GC-6 | SS dependencies: arrow from start of predecessor bar to start of successor bar |
| GC-7 | Non-workdays shown as vertical shaded bands on the timeline |
| GC-8 | Zoom controls: zoom in (day-level) / zoom out (week/month level) |
| GC-9 | Horizontal scroll for timeline navigation |
| GC-10 | Activity labels on or beside bars: description (truncated if needed) |
| GC-11 | Hover/click on bar shows full detail tooltip: description, trade partner, dates, duration, status |
| GC-12 | "Today" vertical marker line |
| GC-13 | **Desktop:** Full Gantt with activity list panel on left, chart on right |
| GC-14 | **Mobile:** Simplified view — activity list scrollable, tapping an activity highlights and scrolls to its bar |
| GC-15 | Optional: group activities by trade partner (collapsible sections) |

### 3.5 View Switching

| ID | Requirement |
|---|---|
| VS-1 | Tab bar or toggle to switch between List / Calendar / Gantt views |
| VS-2 | View state persists when switching (same job stays selected) |
| VS-3 | URL reflects current view and selected job (shareable links) |

---

## 4. Non-Functional Requirements

### 4.1 Responsive Design

| ID | Requirement |
|---|---|
| RD-1 | Desktop breakpoint: ≥1024px — full-featured views |
| RD-2 | Tablet breakpoint: 768–1023px — adapted layouts |
| RD-3 | Mobile breakpoint: <768px — mobile-optimized views |
| RD-4 | Touch-friendly controls on mobile (minimum 44px tap targets) |
| RD-5 | No horizontal scroll on mobile except within Gantt chart area |

### 4.2 Performance

| ID | Requirement |
|---|---|
| PF-1 | Schedule load time: <2 seconds for any job (185–212 activities) |
| PF-2 | View switching: <500ms (data already loaded) |
| PF-3 | Gantt chart renders smoothly with 200+ activities and dependency lines |
| PF-4 | Lazy-load dependency lines if performance is impacted |

### 4.3 Browser Support

| ID | Requirement |
|---|---|
| BS-1 | Chrome (latest), Safari (latest), Firefox (latest) |
| BS-2 | iOS Safari and Android Chrome for mobile |

---

## 5. Data Model Reference

### 5.1 Key Tables

**`jobs`** (10 records)
- `job_rid`, `schedule_rid`, `community_name`, `lot_number`, `plan_name`
- `start_date`, `estimated_end_date`, `status`

**`job_schedule_activities`** (1,950 records)
- `jsa_rid`, `schedule_rid`, `description`, `trade_partner_name`, `status`
- `original_duration`, `current_duration`
- `original_start_date`, `current_start_date`
- `original_end_date`, `current_end_date`
- `approved_on`, `created_on`, `updated_on`

**`job_schedule_activity_dependencies`** (2,225 records)
- `jsa_dependency_rid`, `schedule_rid`
- `predecessor_jsa_rid`, `successor_jsa_rid`
- `dependency_type` (FS or SS)
- `lag_days` (workday offset; positive = later, negative = earlier)

**`calendar_days`** (365 records)
- `day_date`, `is_workday`, `day_of_week`, `description`

### 5.2 Dependency Logic (for Gantt arrows)
- **FS (Finish-Start):** Predecessor finish → Successor start
- **SS (Start-Start):** Predecessor start → Successor start
- Lag days are workday offsets using `calendar_days`

### 5.3 Key Queries

**Load schedule for a job:**
```sql
SELECT jsa.* 
FROM job_schedule_activities jsa
JOIN jobs j ON j.schedule_rid = jsa.schedule_rid
WHERE j.job_rid = :selected_job_rid
ORDER BY jsa.current_start_date;
```

**Load dependencies for a schedule:**
```sql
SELECT d.*
FROM job_schedule_activity_dependencies d
WHERE d.schedule_rid = :schedule_rid;
```

**Load calendar for date range:**
```sql
SELECT * FROM calendar_days
WHERE day_date BETWEEN :start AND :end
ORDER BY day_date;
```

---

## 6. UI Wireframe Concepts

### 6.1 Layout Structure
```
┌─────────────────────────────────────────────────┐
│  Schedule Manager                    [Job ▼]    │
├─────────────────────────────────────────────────┤
│  Community: Miralon | Lot: 78 | Status: InConst │
│  Start: Jan 5, 2026 | Est. End: Jul 15, 2026   │
├────────┬──────────┬─────────────────────────────┤
│  List  │ Calendar │  Gantt                      │
├────────┴──────────┴─────────────────────────────┤
│                                                 │
│           [Active View Content]                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.2 Mobile Layout
```
┌──────────────────────┐
│ Schedule Manager     │
│ [Job Selector ▼]     │
│ Miralon — Lot 78     │
│ Jan 5 → Jul 15, 2026 │
├──────────────────────┤
│ [List] [Cal] [Gantt] │
├──────────────────────┤
│                      │
│  [Active View]       │
│  (scrollable)        │
│                      │
└──────────────────────┘
```

---

## 7. Technology Recommendations

| Component | Recommendation | Rationale |
|---|---|---|
| Framework | **React** or **vanilla HTML/JS** | Fast POC, runs in browser |
| Gantt Library | **frappe-gantt**, **dhtmlxGantt**, or custom SVG/Canvas | Dependency arrows + zoom |
| Calendar | Custom CSS grid or **FullCalendar.js** | Flexible, responsive |
| Styling | **Tailwind CSS** or simple CSS | Responsive utilities built-in |
| Data Layer | **Supabase JS client** (direct) or lightweight API | Already have credentials |
| Hosting | **localhost** initially | POC scope |

> **Note:** Final tech stack decision deferred to implementation phase. Above are starting recommendations.

---

## 8. Out of Scope (POC)

- Schedule editing or activity manipulation
- Date cascade / recalculation engine
- User authentication or role-based access
- Notifications or alerts
- Print/export functionality
- Multi-schedule comparison
- Critical path highlighting (future enhancement)
- Trade partner management

---

## 9. Future Enhancements (Post-POC)

1. **Critical path analysis** — highlight the longest dependency chain
2. **Drag-and-drop rescheduling** with automatic date cascade
3. **Activity editing** — update status, dates, trade partners
4. **Baseline comparison** — original vs. current schedule overlay
5. **Filters by trade partner** — show/hide specific trades
6. **Export** — PDF, CSV, or image export of any view
7. **Real-time sync** — Supabase realtime subscriptions for live updates
8. **Multi-job comparison** — side-by-side schedule view

---

## 10. Success Criteria

| Criteria | Metric |
|---|---|
| Job selection works | All 10 jobs selectable and load correctly |
| List view complete | All activities displayed with correct data, sortable, filterable |
| Calendar view complete | Activities render on correct dates, month navigation works |
| Gantt view complete | Bars render correctly, dependency arrows drawn, zoom works |
| Mobile responsive | All three views usable on 375px-width screen |
| Performance | Schedule loads in <2s, view switches in <500ms |
| Data accuracy | Dates, durations, statuses, and dependencies match Supabase data |

---

*Awaiting review and approval before implementation begins.*
