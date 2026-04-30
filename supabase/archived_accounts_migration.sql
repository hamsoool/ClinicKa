create extension if not exists pgcrypto;

create table if not exists public.archived_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role text not null check (role in ('student', 'staff', 'admin')),
  email text,
  display_name text,
  account_identifier text,
  archived_by uuid,
  archive_reason text,
  snapshot jsonb not null default '{}'::jsonb,
  archived_at timestamptz not null default timezone('utc', now())
);

create index if not exists archived_accounts_archived_at_idx
  on public.archived_accounts (archived_at desc);

create index if not exists archived_accounts_role_idx
  on public.archived_accounts (role);

alter table public.archived_accounts enable row level security;
