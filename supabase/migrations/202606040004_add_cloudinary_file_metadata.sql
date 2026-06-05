do $$
begin
  if to_regclass('public.files') is null then
    return;
  end if;

  alter table public.files
    add column if not exists storage_provider text not null default 'supabase',
    add column if not exists cloudinary_public_id text,
    add column if not exists cloudinary_resource_type text,
    add column if not exists cloudinary_version text,
    add column if not exists cloudinary_folder text;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'files_storage_provider_check'
      and conrelid = 'public.files'::regclass
  ) then
    alter table public.files
      add constraint files_storage_provider_check
      check (storage_provider in ('supabase', 'cloudinary'));
  end if;
end $$;
