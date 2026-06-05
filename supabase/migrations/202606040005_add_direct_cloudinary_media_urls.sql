do $$
begin
  if to_regclass('public.students') is not null then
    execute '
      alter table public.students
        add column if not exists profile_photo_url text,
        add column if not exists profile_photo_file_name text,
        add column if not exists signature_url text,
        add column if not exists signature_file_name text,
        add column if not exists media_updated_at timestamptz
    ';
  end if;

  if to_regclass('public.lab_chest_xray') is not null then
    execute '
      alter table public.lab_chest_xray
        add column if not exists file_url text,
        add column if not exists file_name text,
        add column if not exists mime_type text,
        add column if not exists cloudinary_public_id text,
        add column if not exists cloudinary_resource_type text,
        add column if not exists cloudinary_version text,
        add column if not exists media_updated_at timestamptz
    ';
  end if;

  if to_regclass('public.lab_cbc') is not null then
    execute '
      alter table public.lab_cbc
        add column if not exists file_url text,
        add column if not exists file_name text,
        add column if not exists mime_type text,
        add column if not exists cloudinary_public_id text,
        add column if not exists cloudinary_resource_type text,
        add column if not exists cloudinary_version text,
        add column if not exists media_updated_at timestamptz
    ';
  end if;

  if to_regclass('public.lab_urinalysis') is not null then
    execute '
      alter table public.lab_urinalysis
        add column if not exists file_url text,
        add column if not exists file_name text,
        add column if not exists mime_type text,
        add column if not exists cloudinary_public_id text,
        add column if not exists cloudinary_resource_type text,
        add column if not exists cloudinary_version text,
        add column if not exists media_updated_at timestamptz
    ';
  end if;

  if to_regclass('public.students') is not null and to_regclass('public.files') is not null then
    execute '
      with latest_assets as (
        select distinct on (uploaded_by, type)
          uploaded_by,
          type,
          file_name,
          url,
          uploaded_at
        from public.files
        where submission_id is null
          and storage_provider = ''cloudinary''
          and type in (''photo'', ''signature'')
          and nullif(url, '''') is not null
        order by uploaded_by, type, uploaded_at desc nulls last
      )
      update public.students s
      set
        profile_photo_url = coalesce(s.profile_photo_url, latest_assets.url),
        profile_photo_file_name = coalesce(s.profile_photo_file_name, latest_assets.file_name),
        media_updated_at = coalesce(s.media_updated_at, latest_assets.uploaded_at)
      from latest_assets
      where latest_assets.type = ''photo''
        and s.profile_id = latest_assets.uploaded_by
        and s.profile_photo_url is null
    ';

    execute '
      with latest_assets as (
        select distinct on (uploaded_by, type)
          uploaded_by,
          type,
          file_name,
          url,
          uploaded_at
        from public.files
        where submission_id is null
          and storage_provider = ''cloudinary''
          and type in (''photo'', ''signature'')
          and nullif(url, '''') is not null
        order by uploaded_by, type, uploaded_at desc nulls last
      )
      update public.students s
      set
        signature_url = coalesce(s.signature_url, latest_assets.url),
        signature_file_name = coalesce(s.signature_file_name, latest_assets.file_name),
        media_updated_at = coalesce(s.media_updated_at, latest_assets.uploaded_at)
      from latest_assets
      where latest_assets.type = ''signature''
        and s.profile_id = latest_assets.uploaded_by
        and s.signature_url is null
    ';
  end if;

  if to_regclass('public.files') is not null then
    if to_regclass('public.lab_chest_xray') is not null then
      execute '
        update public.lab_chest_xray lab
        set
          file_url = coalesce(lab.file_url, files.url),
          file_name = coalesce(lab.file_name, files.file_name),
          mime_type = coalesce(lab.mime_type, files.mime_type),
          cloudinary_public_id = coalesce(lab.cloudinary_public_id, files.cloudinary_public_id),
          cloudinary_resource_type = coalesce(lab.cloudinary_resource_type, files.cloudinary_resource_type),
          cloudinary_version = coalesce(lab.cloudinary_version, files.cloudinary_version),
          media_updated_at = coalesce(lab.media_updated_at, files.uploaded_at)
        from public.files
        where lab.file_id = files.id
          and files.storage_provider = ''cloudinary''
          and nullif(files.url, '''') is not null
          and lab.file_url is null
      ';
    end if;

    if to_regclass('public.lab_cbc') is not null then
      execute '
        update public.lab_cbc lab
        set
          file_url = coalesce(lab.file_url, files.url),
          file_name = coalesce(lab.file_name, files.file_name),
          mime_type = coalesce(lab.mime_type, files.mime_type),
          cloudinary_public_id = coalesce(lab.cloudinary_public_id, files.cloudinary_public_id),
          cloudinary_resource_type = coalesce(lab.cloudinary_resource_type, files.cloudinary_resource_type),
          cloudinary_version = coalesce(lab.cloudinary_version, files.cloudinary_version),
          media_updated_at = coalesce(lab.media_updated_at, files.uploaded_at)
        from public.files
        where lab.file_id = files.id
          and files.storage_provider = ''cloudinary''
          and nullif(files.url, '''') is not null
          and lab.file_url is null
      ';
    end if;

    if to_regclass('public.lab_urinalysis') is not null then
      execute '
        update public.lab_urinalysis lab
        set
          file_url = coalesce(lab.file_url, files.url),
          file_name = coalesce(lab.file_name, files.file_name),
          mime_type = coalesce(lab.mime_type, files.mime_type),
          cloudinary_public_id = coalesce(lab.cloudinary_public_id, files.cloudinary_public_id),
          cloudinary_resource_type = coalesce(lab.cloudinary_resource_type, files.cloudinary_resource_type),
          cloudinary_version = coalesce(lab.cloudinary_version, files.cloudinary_version),
          media_updated_at = coalesce(lab.media_updated_at, files.uploaded_at)
        from public.files
        where lab.file_id = files.id
          and files.storage_provider = ''cloudinary''
          and nullif(files.url, '''') is not null
          and lab.file_url is null
      ';
    end if;
  end if;
end $$;
