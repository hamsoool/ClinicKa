-- Fix for: Could not find the table 'public.kv_store_2a5e1a6b' in the schema cache.
-- Run this in the Supabase SQL Editor for the project.

create table if not exists public.kv_store_2a5e1a6b (
  key text primary key,
  value jsonb not null
);

notify pgrst, 'reload schema';
