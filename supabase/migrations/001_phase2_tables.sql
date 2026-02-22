-- Phase 2: Schedule Manipulation & User Management
-- Sprint 1: Database schema changes

-- 1. User profiles (links to Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Staged changes (per-user sandbox for edits before publishing)
CREATE TABLE IF NOT EXISTS staged_changes (
  staged_change_rid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  job_schedule_rid UUID NOT NULL,
  jsa_rid UUID NOT NULL,
  move_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  original_value TEXT,
  staged_value TEXT NOT NULL,
  is_direct_edit BOOLEAN NOT NULL DEFAULT TRUE,
  source_jsa_rid UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staged_user ON staged_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_staged_schedule ON staged_changes(job_schedule_rid);
CREATE INDEX IF NOT EXISTS idx_staged_jsa ON staged_changes(jsa_rid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staged_unique ON staged_changes(user_id, jsa_rid, field_name);

-- 3. Publish events (batch of published changes)
CREATE TABLE IF NOT EXISTS publish_events (
  publish_event_rid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  job_schedule_rid UUID NOT NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  publish_note TEXT NOT NULL,
  move_types TEXT[] NOT NULL,
  change_count INTEGER NOT NULL,
  direct_edit_count INTEGER NOT NULL,
  cascaded_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publish_user ON publish_events(user_id);
CREATE INDEX IF NOT EXISTS idx_publish_schedule ON publish_events(job_schedule_rid);
CREATE INDEX IF NOT EXISTS idx_publish_timestamp ON publish_events(published_at);

-- 4. Change records (individual field-level changes within a publish event)
CREATE TABLE IF NOT EXISTS change_records (
  change_record_rid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_event_rid UUID NOT NULL REFERENCES publish_events(publish_event_rid),
  jsa_rid UUID NOT NULL,
  job_schedule_rid UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  is_direct_edit BOOLEAN NOT NULL DEFAULT TRUE,
  source_jsa_rid UUID,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_publish ON change_records(publish_event_rid);
CREATE INDEX IF NOT EXISTS idx_change_jsa ON change_records(jsa_rid);
CREATE INDEX IF NOT EXISTS idx_change_schedule ON change_records(job_schedule_rid);
CREATE INDEX IF NOT EXISTS idx_change_timestamp ON change_records(changed_at);

-- 5. Add audit columns to job_schedule_activities
ALTER TABLE job_schedule_activities
ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ;
