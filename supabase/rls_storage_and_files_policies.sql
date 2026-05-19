-- Storage + files table RLS policies for clinic uploads.
-- Run this in Supabase SQL Editor.

begin;

create or replace function public.normalize_clinic_storage_path(target_path text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  cleaned text := regexp_replace(coalesce(target_path, ''), '^/+', '');
  first_segment text := split_part(cleaned, '/', 1);
begin
  if first_segment in (
    'medical-files',
    'profile',
    'student_signature',
    'lab_chest_xray',
    'lab_cbc',
    'lab_urinalysis'
  ) then
    return regexp_replace(cleaned, '^[^/]+/?', '');
  end if;

  return cleaned;
end;
$$;

create or replace function public.current_requester_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_requester_student_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(p.student_id, ''), s.student_id)
  from public.profiles p
  left join public.students s on s.profile_id = p.id
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_requester_is_staff_or_higher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_requester_profile_role() in ('staff', 'admin', 'super_admin'), false);
$$;

create or replace function public.submission_id_from_storage_path(target_path text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  cleaned text := public.normalize_clinic_storage_path(target_path);
  first_segment text := split_part(cleaned, '/', 1);
begin
  if first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;

  return null;
end;
$$;

create or replace function public.profile_asset_student_id_from_storage_path(target_path text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  cleaned text := public.normalize_clinic_storage_path(target_path);
  first_segment text := split_part(cleaned, '/', 1);
  second_segment text := split_part(cleaned, '/', 2);
begin
  if first_segment = 'profiles' and nullif(trim(second_segment), '') is not null then
    return trim(second_segment);
  end if;

  return null;
end;
$$;

create or replace function public.current_requester_can_access_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when target_submission_id is null then false
      else public.current_requester_is_staff_or_higher()
        or exists (
          select 1
          from public.submissions sub
          where sub.id = target_submission_id
            and sub.student_id = public.current_requester_student_id()
        )
    end;
$$;

create or replace function public.current_requester_can_access_profile_assets(target_student_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when nullif(trim(coalesce(target_student_id, '')), '') is null then false
      else public.current_requester_is_staff_or_higher()
        or trim(target_student_id) = public.current_requester_student_id()
    end;
$$;

alter table public.files enable row level security;

-- ------------------------------------------------------------
-- storage.objects policies
-- ------------------------------------------------------------
drop policy if exists "Authenticated can upload clinic buckets" on storage.objects;
drop policy if exists "Authenticated can read clinic buckets" on storage.objects;
drop policy if exists "Authenticated can read scoped clinic submission buckets" on storage.objects;
drop policy if exists "Authenticated can upload scoped clinic submission buckets" on storage.objects;
drop policy if exists "Authenticated can read scoped profile asset buckets" on storage.objects;
drop policy if exists "Authenticated can upload scoped profile asset buckets" on storage.objects;

create policy "Authenticated can read scoped clinic submission buckets"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('medical-files', 'lab_chest_xray', 'lab_cbc', 'lab_urinalysis')
  and public.current_requester_can_access_submission(public.submission_id_from_storage_path(name))
);

create policy "Authenticated can upload scoped clinic submission buckets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('medical-files', 'lab_chest_xray', 'lab_cbc', 'lab_urinalysis')
  and public.current_requester_can_access_submission(public.submission_id_from_storage_path(name))
);

create policy "Authenticated can read scoped profile asset buckets"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('profile', 'student_signature')
  and public.current_requester_can_access_profile_assets(
    public.profile_asset_student_id_from_storage_path(name)
  )
);

create policy "Authenticated can upload scoped profile asset buckets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('profile', 'student_signature')
  and public.current_requester_can_access_profile_assets(
    public.profile_asset_student_id_from_storage_path(name)
  )
);

-- ------------------------------------------------------------
-- public.files policies
-- ------------------------------------------------------------
drop policy if exists "Authenticated can insert files metadata" on public.files;
drop policy if exists "Authenticated can read files metadata" on public.files;
drop policy if exists "Authenticated can insert scoped files metadata" on public.files;
drop policy if exists "Authenticated can read scoped files metadata" on public.files;

create policy "Authenticated can insert scoped files metadata"
on public.files
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    (
      submission_id is not null
      and storage_bucket in ('medical-files', 'lab_chest_xray', 'lab_cbc', 'lab_urinalysis')
      and submission_id = public.submission_id_from_storage_path(storage_path)
      and public.current_requester_can_access_submission(submission_id)
    )
    or
    (
      submission_id is null
      and type in ('photo', 'signature')
      and storage_bucket in ('profile', 'student_signature')
      and public.current_requester_can_access_profile_assets(
        public.profile_asset_student_id_from_storage_path(storage_path)
      )
    )
  )
);

create policy "Authenticated can read scoped files metadata"
on public.files
for select
to authenticated
using (
  (
    submission_id is not null
    and public.current_requester_can_access_submission(submission_id)
  )
  or
  (
    submission_id is null
    and type in ('photo', 'signature')
    and public.current_requester_can_access_profile_assets(
      public.profile_asset_student_id_from_storage_path(storage_path)
    )
  )
);

commit;
