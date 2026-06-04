create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  notification_key text not null,
  status text not null check (status in ('approved', 'returned')),
  title text not null,
  message text not null,
  note text,
  action_label text not null,
  action_path text not null,
  year_label text not null,
  occurred_at timestamptz not null,
  is_read boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (student_id, notification_key)
);

create index if not exists student_notifications_student_id_idx
  on public.student_notifications (student_id, occurred_at desc);

create index if not exists student_notifications_deleted_at_idx
  on public.student_notifications (deleted_at);
