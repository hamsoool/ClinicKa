-- Cleanup script for files rows still pointing to deleted `medical-files` bucket.
-- Run in Supabase SQL Editor.

begin;

-- 1) Preview rows that still reference old bucket/path
select
  id,
  submission_id,
  type,
  storage_bucket,
  storage_path,
  file_name
from public.files
where coalesce(storage_bucket, '') = 'medical-files'
   or coalesce(storage_path, '') like 'medical-files/%'
order by uploaded_at desc nulls last;

-- 2) Rewrite bucket + normalized path based on file type
update public.files
set
  storage_bucket = case
    when lower(type) = 'photo' then 'profile'
    when lower(type) = 'signature' then 'student_signature'
    when lower(type) = 'xray' then 'lab_chest_xray'
    when lower(type) = 'cbc' then 'lab_cbc'
    when lower(type) = 'urinalysis' then 'lab_urinalysis'
    else storage_bucket
  end,
  storage_path = case
    when coalesce(storage_path, '') like 'medical-files/%'
      then regexp_replace(storage_path, '^medical-files/', '')
    else storage_path
  end
where coalesce(storage_bucket, '') = 'medical-files'
   or coalesce(storage_path, '') like 'medical-files/%';

-- 3) (Optional) Preview any rows with bucket still null/old after migration
select
  id,
  submission_id,
  type,
  storage_bucket,
  storage_path
from public.files
where storage_bucket is null
   or storage_bucket = 'medical-files'
order by uploaded_at desc nulls last;

commit;

