# ClinicKa

ClinicKa is a web-based clinic management system for Gordon College. It helps students submit medical requirements, lets clinic staff review and clear records, and gives admins control over users and system operations.

The app is a React + Vite frontend connected to Supabase (Auth, Postgres, Storage, and Edge Functions).

## What The System Does

ClinicKa has three role-based portals:

- Student portal (`/student`): profile management, yearly medical form submission, requirements tracking, and certificate viewing.
- Staff portal (`/staff`): submission queue, detailed record review, status updates (`pending`, `returned`, `physical_exam_done`, `approved`, `resubmitted`), and certificate workflows.
- Admin portal (`/admin`): user account management, staff management, archived account lifecycle, and reports.

## System Overview (End-to-End)

1. User signs in (email/password or Google OAuth).
2. Frontend reads/writes data in Supabase tables and storage buckets.
3. Sensitive/admin-style operations go through Supabase Edge Function routes under:
   - `/functions/v1/server/*`
4. Staff status changes trigger email notifications through the Supabase Edge Function route `/functions/v1/server/notifications/status-email`.

Core backend entrypoint:

- `supabase/functions/server/index.ts`

## Tech Stack

- React 18 + TypeScript
- React Router 7
- Vite 6 + Tailwind CSS 4
- TanStack Query
- Supabase Auth + Postgres + Storage + Edge Functions
- PWA support via `vite-plugin-pwa` / Workbox

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (required)
- Supabase CLI (optional but recommended for function deployment/testing)

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Fill required environment variables in `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Start development server:

```bash
npm run dev
```

App URL: `http://localhost:5173`

## Environment Variables

Required for frontend runtime:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Required for server-side operations used by scripts and the Supabase Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional but required if you want email notifications to send successfully:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

Notes:

- `.env.example` also includes `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_PUBLISHABLE_KEY` for project compatibility; current app runtime primarily uses the variables listed above.
- Never commit real secrets from `.env.local`.

## Supabase Setup Notes

This repository includes policy/patch SQL files (not a complete schema bootstrap). Ensure your Supabase project has the expected ClinicKa tables before running the app.

Apply the SQL files in `supabase/` as needed:

- `supabase/rls_storage_and_files_policies.sql`
- `supabase/fix_files_bucket_migration.sql`
- `supabase/archived_accounts_migration.sql`
- `supabase/add_lab_test_source_columns.sql`
- `supabase/add_resubmitted_status_constraint_migration.sql`

Expected storage buckets used by uploads:

- `profile`
- `student_signature`
- `lab_chest_xray`
- `lab_cbc`
- `lab_urinalysis`
- (legacy references may still point to `medical-files`, use the migration above)

## Useful Scripts

- `npm run dev` - Start local development server
- `npm run typecheck` - TypeScript check (no emit)
- `npm run build` - Production build into `dist/`
- `npm run check` - `typecheck` + `build`

Optional helper script:

- `scripts/create-admin-account.local.mjs` - create/bootstrap a user via Supabase Admin API using env credentials.

## Project Structure

```text
src/
  app/
    pages/               Role-based pages (student, staff, admin, auth)
    lib/                 Auth/API client logic
    components/          Shared UI, shell, reports, previews
  styles/                Global and font/style files
supabase/
  functions/server/      Edge function API
  *.sql                  SQL migrations/policies
scripts/                 Utility scripts (admin bootstrap, exports)
public/                  Static assets + PWA icons
```

## Build And Deploy

1. Build frontend:

```bash
npm run build
```

2. Deploy `dist/` to your static host.
3. Deploy/update Supabase edge function (`server`) for backend routes, including status-email notifications.
4. Add the `SMTP_*` secrets to the deployed edge-function environment if email notifications should be enabled.

`vercel.json` already includes SPA rewrite rules for client-side routing.

## Troubleshooting

- `Missing Supabase config...`: check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Upload/sign URL errors: verify buckets exist and run `rls_storage_and_files_policies.sql`.
- Archived account endpoints returning migration errors: run `archived_accounts_migration.sql`.
- Google sign-in blocked: student accounts are restricted to `@gordoncollege.edu.ph`.
- Email notifications not sending: verify `SMTP_*` values are available to the deployed Supabase edge function (and in `.env.local` if you also use local function tooling).
