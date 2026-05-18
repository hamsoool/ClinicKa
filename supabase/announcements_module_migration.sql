begin;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_path text,
  date_posted date not null default current_date,
  is_published boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_date_posted_idx
  on public.announcements (date_posted desc, created_at desc);
create index if not exists announcements_created_by_idx
  on public.announcements (created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

drop policy if exists "students can read published announcements" on public.announcements;
create policy "students can read published announcements"
on public.announcements
for select
to authenticated
using (is_published = true);

drop policy if exists "clinic staff and doctor can read own announcements" on public.announcements;
create policy "clinic staff and doctor can read own announcements"
on public.announcements
for select
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
);

drop policy if exists "admin can manage all announcements" on public.announcements;
create policy "admin can manage all announcements"
on public.announcements
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "clinic staff and doctor can insert own announcements" on public.announcements;
create policy "clinic staff and doctor can insert own announcements"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
);

drop policy if exists "clinic staff and doctor can update own announcements" on public.announcements;
create policy "clinic staff and doctor can update own announcements"
on public.announcements
for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
);

drop policy if exists "clinic staff and doctor can delete own announcements" on public.announcements;
create policy "clinic staff and doctor can delete own announcements"
on public.announcements
for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
);

insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', false)
on conflict (id) do nothing;

drop policy if exists "authenticated can read announcements bucket" on storage.objects;
create policy "authenticated can read announcements bucket"
on storage.objects
for select
to authenticated
using (bucket_id = 'announcements');

drop policy if exists "admin can manage announcements bucket" on storage.objects;
create policy "admin can manage announcements bucket"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'announcements'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  bucket_id = 'announcements'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "staff doctor can upload own announcements bucket folder" on storage.objects;
create policy "staff doctor can upload own announcements bucket folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'announcements'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
);

drop policy if exists "staff doctor can update own announcements bucket folder" on storage.objects;
create policy "staff doctor can update own announcements bucket folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'announcements'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
)
with check (
  bucket_id = 'announcements'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
);

drop policy if exists "staff doctor can delete own announcements bucket folder" on storage.objects;
create policy "staff doctor can delete own announcements bucket folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'announcements'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles p
    join public.staff_users s on s.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'staff'
      and lower(regexp_replace(coalesce(s.position, ''), '\s+', ' ', 'g')) in (
        'clinic staff',
        'clinic doctor',
        'clinic nurse / doctor'
      )
  )
);

commit;
