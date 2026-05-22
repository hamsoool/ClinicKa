alter table public.certificates
  add column if not exists license_no text;
