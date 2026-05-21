-- Performance indexes for high-traffic Supabase queries.
-- Merge-safe: each index is created only if the target table exists.

DO $$
BEGIN
  IF to_regclass('public.students') IS NOT NULL THEN
    -- students lookups by student_id
    CREATE INDEX IF NOT EXISTS idx_students_student_id
      ON public.students (student_id);
  END IF;

  IF to_regclass('public.submissions') IS NOT NULL THEN
    -- submissions: common student timeline lookup + latest first
    CREATE INDEX IF NOT EXISTS idx_submissions_student_id_submitted_at_desc
      ON public.submissions (student_id, submitted_at DESC);

    -- submissions: frequent status filters and analytics counts
    CREATE INDEX IF NOT EXISTS idx_submissions_status
      ON public.submissions (status);

    -- submissions: approved listings ordered by updated_at
    CREATE INDEX IF NOT EXISTS idx_submissions_status_updated_at_desc
      ON public.submissions (status, updated_at DESC);
  END IF;

  IF to_regclass('public.files') IS NOT NULL THEN
    -- files: profile assets by uploader with null submission_id and type, latest first
    CREATE INDEX IF NOT EXISTS idx_files_uploaded_by_submission_type_uploaded_at_desc
      ON public.files (uploaded_by, submission_id, type, uploaded_at DESC);

    -- files: submission attachment lookup by submission_id + type, latest first
    CREATE INDEX IF NOT EXISTS idx_files_submission_type_uploaded_at_desc
      ON public.files (submission_id, type, uploaded_at DESC);

    -- files: cleanup query uses left-anchored LIKE on storage_path
    CREATE INDEX IF NOT EXISTS idx_files_uploaded_by_submission_type_storage_path_pattern
      ON public.files (uploaded_by, submission_id, type, storage_path text_pattern_ops);
  END IF;
END $$;
