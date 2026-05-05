-- Allow "resubmitted" as a valid submissions.status value.
-- Run this once in Supabase SQL editor for production/dev databases.

alter table public.submissions
drop constraint if exists submissions_status_check;

alter table public.submissions
add constraint submissions_status_check
check (
  status in (
    'pending',
    'physical_exam_done',
    'approved',
    'returned',
    'resubmitted'
  )
);
