-- Database recovery / performance hardening
-- Run in the Supabase SQL Editor.

begin;

-- Keep submissions.status aligned with the app states currently used in production.
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

-- The student notification feature depends on this table.
create table if not exists public.kv_store_2a5e1a6b (
  key text primary key,
  value jsonb not null
);

-- Indexes for the heaviest dashboard and record queries.
create index if not exists submissions_student_id_submitted_at_idx
  on public.submissions (student_id, submitted_at desc);

create index if not exists submissions_status_idx
  on public.submissions (status);

create index if not exists emergency_contacts_submission_id_idx
  on public.emergency_contacts (submission_id);

create index if not exists medical_history_submission_id_idx
  on public.medical_history (submission_id);

create index if not exists staff_measurements_submission_id_idx
  on public.staff_measurements (submission_id);

create index if not exists lab_chest_xray_submission_id_idx
  on public.lab_chest_xray (submission_id);

create index if not exists lab_cbc_submission_id_idx
  on public.lab_cbc (submission_id);

create index if not exists lab_urinalysis_submission_id_idx
  on public.lab_urinalysis (submission_id);

create index if not exists certificates_submission_id_idx
  on public.certificates (submission_id);

create index if not exists files_submission_id_idx
  on public.files (submission_id);

create index if not exists files_uploaded_by_submission_id_uploaded_at_idx
  on public.files (uploaded_by, submission_id, uploaded_at desc);

create index if not exists students_profile_id_idx
  on public.students (profile_id);

create index if not exists staff_users_profile_id_idx
  on public.staff_users (profile_id);

commit;
