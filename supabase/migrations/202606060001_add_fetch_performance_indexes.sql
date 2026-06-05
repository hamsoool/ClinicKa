do $$
begin
  if to_regclass('public.submissions') is not null then
    create index if not exists submissions_status_submitted_at_idx
      on public.submissions (status, submitted_at desc);

    create index if not exists submissions_status_updated_at_idx
      on public.submissions (status, updated_at desc);

    create index if not exists submissions_student_id_submitted_at_idx
      on public.submissions (student_id, submitted_at desc);

    create index if not exists submissions_student_id_status_updated_at_idx
      on public.submissions (student_id, status, updated_at desc);

    create index if not exists submissions_year_level_status_updated_at_idx
      on public.submissions (year_level, status, updated_at desc);

    create index if not exists submissions_department_status_updated_at_idx
      on public.submissions (department, status, updated_at desc);

    create index if not exists submissions_course_status_updated_at_idx
      on public.submissions (course, status, updated_at desc);
  end if;

  if to_regclass('public.files') is not null then
    create index if not exists files_submission_id_type_uploaded_at_idx
      on public.files (submission_id, type, uploaded_at desc);

    create index if not exists files_uploaded_by_profile_assets_idx
      on public.files (uploaded_by, type, uploaded_at desc)
      where submission_id is null;
  end if;

  if to_regclass('public.students') is not null then
    create index if not exists students_profile_id_idx
      on public.students (profile_id);

    create index if not exists students_student_id_profile_id_idx
      on public.students (student_id, profile_id);
  end if;

  if to_regclass('public.staff_users') is not null then
    create index if not exists staff_users_profile_id_idx
      on public.staff_users (profile_id);

    create index if not exists staff_users_is_active_id_idx
      on public.staff_users (is_active, id);
  end if;

  if to_regclass('public.archived_accounts') is not null then
    create index if not exists archived_accounts_user_id_idx
      on public.archived_accounts (user_id);

    create index if not exists archived_accounts_role_archived_at_idx
      on public.archived_accounts (role, archived_at desc);
  end if;
end
$$;
