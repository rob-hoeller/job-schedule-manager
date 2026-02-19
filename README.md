# Job Schedule Manager

A construction schedule management tool for Schell Brothers. Visualize job schedules across multiple views — list, calendar, and Gantt chart — with full dependency tracking.

## Features

- **Job Selector** — Browse schedules by community and lot number
- **List View** — Sortable, filterable activity table with status badges and dependency details
- **Calendar View** — Monthly grid with activity bars, holiday shading, and mobile-friendly layout
- **Gantt Chart** — Horizontal timeline with dependency arrows, zoom controls, and today marker
- **Responsive** — Desktop, tablet, and mobile breakpoints
- **Dark/Light Mode** — Follows device preference by default

## Data

Powered by Supabase (PostgreSQL) with four core tables:

| Table | Records | Description |
|---|---|---|
| `jobs` | 10 | Active construction jobs across 7 communities |
| `job_schedule_activities` | 1,950 | Scheduled activities per job |
| `job_schedule_activity_dependencies` | 2,225 | FS/SS dependency relationships with lag days |
| `calendar_days` | 365 | 2026 workday calendar with holidays |

## Tech Stack

*TBD — to be finalized during implementation.*

## Hosting

Deployed via **Vercel**.

## Documentation

See [`docs/`](./docs/) for project documentation including the PRD.

## License

Private — Schell Brothers internal use.
