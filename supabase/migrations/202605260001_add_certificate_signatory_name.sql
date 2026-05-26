alter table public.certificates
  add column if not exists signatory_name text;

comment on column public.certificates.signatory_name is
  'Display name of the physician selected as the medical clearance signatory.';
