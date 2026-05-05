-- Adds source metadata for student laboratory tests.
-- This allows staff to see whether tests were done at James L. Gordon Hospital
-- or an external clinic/laboratory.

alter table public.submissions
add column if not exists lab_test_location text;

alter table public.submissions
add column if not exists lab_test_clinic text;

alter table public.submissions
drop constraint if exists submissions_lab_test_location_check;

alter table public.submissions
add constraint submissions_lab_test_location_check
check (lab_test_location in ('jlgh', 'other') or lab_test_location is null);
