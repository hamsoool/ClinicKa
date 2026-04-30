-- Storage + files table RLS policies for student uploads
-- Run this in Supabase SQL Editor.

begin;

-- ------------------------------------------------------------
-- storage.objects INSERT/SELECT for authenticated users
-- Limited to the new buckets used by the student portal.
-- ------------------------------------------------------------
drop policy if exists "Authenticated can upload clinic buckets" on storage.objects;
create policy "Authenticated can upload clinic buckets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in (
    'student_signature',
    'profile',
    'lab_chest_xray',
    'lab_urinalysis',
    'lab_cbc'
  )
);

drop policy if exists "Authenticated can read clinic buckets" on storage.objects;
create policy "Authenticated can read clinic buckets"
on storage.objects
for select
to authenticated
using (
  bucket_id in (
    'student_signature',
    'profile',
    'lab_chest_xray',
    'lab_urinalysis',
    'lab_cbc'
  )
);

-- ------------------------------------------------------------
-- public.files INSERT/SELECT metadata rows for authenticated users
-- ------------------------------------------------------------
alter table public.files enable row level security;

drop policy if exists "Authenticated can insert files metadata" on public.files;
create policy "Authenticated can insert files metadata"
on public.files
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can read files metadata" on public.files;
create policy "Authenticated can read files metadata"
on public.files
for select
to authenticated
using (true);

commit;
