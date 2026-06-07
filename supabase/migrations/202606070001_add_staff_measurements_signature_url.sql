alter table if exists public.staff_measurements
  add column if not exists examined_by_signature_url text;

update public.staff_measurements as sm
set examined_by_signature_url = su.signature_url
from public.submissions as sub,
     public.staff_users as su
where sm.submission_id = sub.id
  and su.id = coalesce(sm.updated_by, sub.reviewed_by)
  and coalesce(nullif(trim(sm.examined_by_signature_url), ''), '') = ''
  and coalesce(nullif(trim(su.signature_url), ''), '') <> '';
