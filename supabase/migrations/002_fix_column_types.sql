-- Fix: jsa_rid, job_schedule_rid, source_jsa_rid are integers, not UUIDs

-- staged_changes
ALTER TABLE staged_changes
  ALTER COLUMN jsa_rid TYPE BIGINT USING jsa_rid::text::bigint,
  ALTER COLUMN job_schedule_rid TYPE BIGINT USING job_schedule_rid::text::bigint,
  ALTER COLUMN source_jsa_rid TYPE BIGINT USING source_jsa_rid::text::bigint;

-- publish_events
ALTER TABLE publish_events
  ALTER COLUMN job_schedule_rid TYPE BIGINT USING job_schedule_rid::text::bigint;

-- change_records
ALTER TABLE change_records
  ALTER COLUMN jsa_rid TYPE BIGINT USING jsa_rid::text::bigint,
  ALTER COLUMN job_schedule_rid TYPE BIGINT USING job_schedule_rid::text::bigint,
  ALTER COLUMN source_jsa_rid TYPE BIGINT USING source_jsa_rid::text::bigint;
