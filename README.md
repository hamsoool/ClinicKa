# ClinicKa

ClinicKa is a web-based clinic management system for Gordon College. It helps students submit medical requirements, lets clinic staff review and clear records, and gives admins control over users and system operations.

The app is a React + Vite frontend connected to Supabase (Auth, Postgres, Storage, and Edge Functions).

## What The System Does

ClinicKa has four role-based portals:

- Student portal (`/student`): profile management, yearly medical form submission, requirements tracking, and certificate viewing.
- Staff portal (`/staff`): submission queue, detailed record review, status updates (`pending`, `returned`, `physical_exam_done`, `approved`, `resubmitted`), and certificate workflows.
- Admin portal (`/admin`): user account management, staff management, archived account lifecycle, and reports.
- Super admin portal (`/super-admin`): add and remove administrator accounts only.

## System Overview (End-to-End)

1. User signs in (email/password or Google OAuth).
2. Frontend reads/writes data in Supabase tables and storage buckets.
3. Sensitive/admin-style operations go through Supabase Edge Function routes under:
   - `/functions/v1/server/*`
4. Staff status changes trigger email notifications through the Supabase Edge Function route `/functions/v1/server/notifications/status-email`.

Core backend entrypoint:

- `supabase/functions/server/index.ts`
- `supabase/functions/server/context.ts` - shared server config, CORS, and response helpers
- `supabase/functions/server/requester.ts` - requester authentication and archived-account helpers
- `supabase/functions/server/settings.ts` - admin settings and student notification-state helpers
- `supabase/functions/server/storage.ts` - storage URL and cleanup helpers
- `supabase/functions/server/submissions.ts` - submission mapping, staff dashboards, and read-cache helpers

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

Required for server-side operations used by the Supabase Edge Function:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` or `ALLOWED_ORIGINS` for deployed Edge Function CORS

Optional but required if you want email notifications to send successfully:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

Notes:

- `.env.example` also includes `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_PUBLISHABLE_KEY` for project compatibility; current app runtime primarily uses the variables listed above.
- Set `ALLOWED_ORIGINS` to your deployed frontend origin before deploying the Supabase Edge Function. Keep `DEBUG_ERRORS=false` and `ENABLE_REQUEST_LOGGING=false` in production.
- Never commit real secrets from `.env.local`.

## Supabase Setup Notes

The app depends on an existing Supabase project with the expected ClinicKa tables, storage buckets, RLS policies, and edge-function environment variables already configured.

This repository keeps the edge-function source under `supabase/functions/server/`, but the SQL migration and patch files were one-time setup artifacts and are no longer stored in the project.

Expected storage buckets used by uploads:

- `profile`
- `student_signature`
- `lab_chest_xray`
- `lab_cbc`
- `lab_urinalysis`
- (legacy references may still point to `medical-files`, so keep bucket compatibility in the target Supabase project)

## Useful Scripts

- `npm run dev` - Start local development server
- `npm run typecheck` - TypeScript check (no emit)
- `npm run build` - Production build into `dist/`
- `npm run check` - `typecheck` + `build`

## Attributions

- UI components in this project include `shadcn/ui`-derived source used under the MIT license.
- Project imagery includes an Unsplash photo used under the Unsplash license.

## Project Structure

```text
src/
  app/
    components/          Shared UI, shell, reports, previews
    lib/                 Auth/API client logic
    pages/               Role-based pages (student, staff, admin, auth)
  assets/previews/       App-owned preview images used by auth/marketing screens
  styles/                Global and font/style files
supabase/
  functions/server/
    index.ts             Route entrypoint
    context.ts           Shared server config and response helpers
    requester.ts         Authentication and requester helpers
    settings.ts          Admin settings and notification-state helpers
    storage.ts           Storage bucket and file cleanup helpers
    submissions.ts       Submission read models and dashboard caches
public/                  Static assets + PWA icons
```

## Build And Deploy

1. Build frontend:

```bash
npm run build
```

2. Deploy `dist/` to your static host.
3. Deploy/update Supabase edge function (`server`) for backend routes, including status-email notifications.
4. Add `SITE_URL` or `ALLOWED_ORIGINS` to the deployed edge-function environment so only your frontend origin can call it from browsers.
5. Add the `SMTP_*` secrets to the deployed edge-function environment if email notifications should be enabled.

`vercel.json` already includes SPA rewrite rules for client-side routing.

## Troubleshooting

- `Missing Supabase config...`: check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Upload/sign URL errors: verify the expected Supabase buckets and storage policies exist in the target project.
- Archived account endpoints returning migration errors: verify the target Supabase project already includes the archived accounts schema changes.
- Google sign-in blocked: student accounts are restricted to `@gordoncollege.edu.ph`.
- Email notifications not sending: verify `SMTP_*` values are available to the deployed Supabase edge function (and in `.env.local` if you also use local function tooling).
