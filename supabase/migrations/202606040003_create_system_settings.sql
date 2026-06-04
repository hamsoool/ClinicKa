create table if not exists public.system_settings (
  key text primary key,
  value text not null
);

insert into public.system_settings (key, value)
values ('current_academic_year', 'SY 2025-2026')
on conflict (key) do nothing;

alter table public.system_settings enable row level security;

grant select on table public.system_settings to anon, authenticated;
grant update on table public.system_settings to authenticated;

drop policy if exists "system_settings_read_all" on public.system_settings;
create policy "system_settings_read_all"
  on public.system_settings
  for select
  to anon, authenticated
  using (true);

do $$
begin
  if to_regclass('public.profiles') is not null then
    drop policy if exists "system_settings_update_admin_only" on public.system_settings;
    create policy "system_settings_update_admin_only"
      on public.system_settings
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      );
  end if;
end
$$;
