-- Performance indexes for high-traffic Supabase queries.
-- Safe to re-run because each index uses IF NOT EXISTS.

-- students lookups by student_id
create index if not exists idx_students_student_id
  on public.students (student_id);

-- submissions: common student timeline lookup + latest first
create index if not exists idx_submissions_student_id_submitted_at_desc
  on public.submissions (student_id, submitted_at desc);

-- submissions: frequent status filters and analytics counts
create index if not exists idx_submissions_status
  on public.submissions (status);

-- submissions: approved listings ordered by updated_at
create index if not exists idx_submissions_status_updated_at_desc
  on public.submissions (status, updated_at desc);

-- files: profile assets by uploader with null submission_id and type, latest first
create index if not exists idx_files_uploaded_by_submission_type_uploaded_at_desc
  on public.files (uploaded_by, submission_id, type, uploaded_at desc);

-- files: submission attachment lookup by submission_id + type, latest first
create index if not exists idx_files_submission_type_uploaded_at_desc
  on public.files (submission_id, type, uploaded_at desc);

-- files: cleanup query uses left-anchored LIKE on storage_path
create index if not exists idx_files_uploaded_by_submission_type_storage_path_pattern
  on public.files (uploaded_by, submission_id, type, storage_path text_pattern_ops);