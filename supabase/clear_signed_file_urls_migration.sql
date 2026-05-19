-- Remove previously stored Supabase signed URLs from file metadata.
-- Runtime code should generate short-lived signed URLs from storage_path instead.

update public.files
set url = null
where storage_path is not null
  and url is not null;
