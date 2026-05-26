alter table public.submissions
  add column if not exists academic_year text;

update public.submissions
set academic_year =
  case
    when extract(month from submitted_at) >= 7
      then concat(extract(year from submitted_at)::int, '-', (extract(year from submitted_at)::int + 1))
    else concat((extract(year from submitted_at)::int - 1), '-', extract(year from submitted_at)::int)
  end
where academic_year is null
  and submitted_at is not null;

create index if not exists idx_submissions_student_academic_year
  on public.submissions (student_id, academic_year);
