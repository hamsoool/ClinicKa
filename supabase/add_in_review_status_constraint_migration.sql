-- Allow "in_review" as a valid submissions.status value.

alter table public.submissions
drop constraint if exists submissions_status_check;

alter table public.submissions
add constraint submissions_status_check
check (
  status in (
    'pending',
    'in_review',
    'physical_exam_done',
    'approved',
    'returned',
    'resubmitted'
  )
);
