do $$
begin
  if to_regclass('public.staff_users') is not null then
    alter table public.staff_users
    add column if not exists signature_url text;
  end if;
end
$$;
